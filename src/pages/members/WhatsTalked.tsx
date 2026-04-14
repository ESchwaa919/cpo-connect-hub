import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { HeroAskCard } from '@/components/members/whats-talked/HeroAskCard'
import { PromptChipRow } from '@/components/members/whats-talked/PromptChipRow'
import {
  AnswerBlock,
  type AnswerBlockState,
} from '@/components/members/whats-talked/AnswerBlock'
import { EmptyState } from '@/components/members/whats-talked/EmptyState'
import { PrivacyNotice } from '@/components/members/whats-talked/PrivacyNotice'
import {
  ChatAskError,
  type AskSource,
  type AskSuccessResponse,
  type ChatErrorCode,
  type ChatErrorResponse,
  type PromptTile as PromptTileData,
  type PromptTilesResponse,
} from '@/components/members/whats-talked/types'
import {
  parseChannelScopeParam,
  serializeChannelScopeParam,
  type ChannelScopeValue,
} from '@/lib/channel-scope-params'
import { readSSE } from '@/lib/sse-parser'
import { useMemberProfile } from '@/hooks/useMemberProfile'

const ASK_STALE_MS = 5 * 60 * 1000
const TILES_STALE_MS = 60 * 60 * 1000

async function fetchPromptTiles(
  scope: ChannelScopeValue,
): Promise<PromptTilesResponse> {
  // prompt-tiles is still single-channel on the server; for the "single
  // channel subset" case we pass that one; for all / multi-channel we
  // omit the filter and let the server return everything.
  const qs =
    scope.mode === 'subset' && scope.ids.length === 1
      ? `?channel=${encodeURIComponent(scope.ids[0])}`
      : ''
  const res = await fetch(`/api/chat/prompt-tiles${qs}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Failed to load prompt tiles (${res.status})`)
  }
  return (await res.json()) as PromptTilesResponse
}

interface StreamCallbacks {
  onSources: (sources: AskSource[]) => void
  onToken: (chunk: string) => void
}

/** POST to /api/chat/ask and consume the SSE stream. On the happy path
 *  the server flushes a `sources` event (forwarded via `onSources`),
 *  then a series of `token` events (each forwarded via `onToken`),
 *  then a `done` event carrying the model name and total queryMs.
 *  Pre-stream failures (bad_query, embedding_unavailable) arrive as a
 *  JSON error body with the same shape the old non-streaming handler
 *  used — clients discriminate on Content-Type. */
async function streamAsk(
  query: string,
  scope: ChannelScopeValue,
  signal: AbortSignal,
  cbs: StreamCallbacks,
): Promise<AskSuccessResponse> {
  const body: Record<string, unknown> = { query }
  if (scope.mode === 'subset') {
    if (scope.ids.length === 1) {
      body.channel = scope.ids[0]
    } else {
      body.channels = scope.ids
    }
  }

  let res: Response
  try {
    res = await fetch('/api/chat/ask', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ChatAskError('internal', 0)
  }

  if (!res.ok) {
    let payload: ChatErrorResponse | null = null
    try {
      payload = (await res.json()) as ChatErrorResponse
    } catch {
      /* non-JSON error body */
    }
    const retryAfterSec =
      payload?.retryAfterSec ??
      (res.headers.get('retry-after')
        ? Number(res.headers.get('retry-after'))
        : undefined)
    throw new ChatAskError(
      payload?.error ?? 'internal',
      res.status,
      Number.isFinite(retryAfterSec) ? (retryAfterSec as number) : undefined,
    )
  }

  if (!res.body) {
    throw new ChatAskError('internal', res.status)
  }

  let accumulated = ''
  let sources: AskSource[] = []
  let done: { model: string; queryMs: number } | null = null
  let emptyMessage: string | null = null
  let emptyQueryMs = 0

  const reader = res.body.getReader()
  try {
    for await (const event of readSSE(reader)) {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(event.data) as Record<string, unknown>
      } catch {
        continue
      }

      if (event.event === 'sources') {
        sources = (parsed.sources as AskSource[]) ?? []
        cbs.onSources(sources)
      } else if (event.event === 'token') {
        const text = typeof parsed.text === 'string' ? parsed.text : ''
        accumulated += text
        cbs.onToken(text)
      } else if (event.event === 'done') {
        done = {
          model:
            typeof parsed.model === 'string' ? parsed.model : 'unknown',
          queryMs:
            typeof parsed.queryMs === 'number' ? parsed.queryMs : 0,
        }
      } else if (event.event === 'empty') {
        emptyMessage =
          typeof parsed.message === 'string' ? parsed.message : null
        emptyQueryMs =
          typeof parsed.queryMs === 'number' ? parsed.queryMs : 0
      } else if (event.event === 'error') {
        const code =
          typeof parsed.code === 'string'
            ? (parsed.code as ChatErrorCode)
            : 'internal'
        const retryAfterSec =
          typeof parsed.retryAfterSec === 'number'
            ? parsed.retryAfterSec
            : undefined
        throw new ChatAskError(code, res.status, retryAfterSec)
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    if (err instanceof ChatAskError) throw err
    throw new ChatAskError('internal', res.status)
  }

  if (emptyMessage !== null) {
    return {
      answer: null,
      sources: [],
      queryMs: emptyQueryMs,
      model: null,
      message: emptyMessage,
    }
  }
  if (!done) {
    throw new ChatAskError('internal', res.status)
  }
  return {
    answer: accumulated,
    sources,
    queryMs: done.queryMs,
    model: done.model,
  }
}

export default function WhatsTalked() {
  const [searchParams, setSearchParams] = useSearchParams()

  // `searchParams` is referentially stable only when the URL changes, so
  // memoizing both `scope` and `scopeKey` keeps React Query's queryKey
  // stable across unrelated re-renders (countdown ticks, submission
  // bumps) and prevents refetches.
  const scope: ChannelScopeValue = useMemo(
    () => parseChannelScopeParam(searchParams),
    [searchParams],
  )
  const scopeKey = useMemo(
    () => serializeChannelScopeParam(scope).channels ?? '',
    [scope],
  )
  const activeQuery = searchParams.get('q') ?? ''

  const [draftQuery, setDraftQuery] = useState(activeQuery)

  useEffect(() => {
    setDraftQuery(activeQuery)
  }, [activeQuery])

  const profileQuery = useMemberProfile()
  const optedOut = profileQuery.data?.chat_query_logging_opted_out === true

  const tilesQuery = useQuery<PromptTilesResponse>({
    queryKey: ['chat-prompt-tiles', scopeKey],
    queryFn: () => fetchPromptTiles(scope),
    staleTime: TILES_STALE_MS,
  })

  // During streaming, the actual React Query data isn't settled until
  // the `done` event arrives. The UI reads the partial answer + sources
  // from these side-channel states so the AnswerBlock can render tokens
  // as they land. Cleared at the start of every new request.
  const [partialAnswer, setPartialAnswer] = useState('')
  const [streamingSources, setStreamingSources] = useState<
    AskSource[] | null
  >(null)
  // Ref for the latest values — the queryFn closure captures setters,
  // not reads, so we don't need a ref here. Keeping the comment as a
  // breadcrumb for future refactors.

  const askQuery = useQuery<AskSuccessResponse, ChatAskError>({
    queryKey: ['chat-ask', activeQuery, scopeKey],
    queryFn: async ({ signal }) => {
      setPartialAnswer('')
      setStreamingSources(null)
      return streamAsk(activeQuery, scope, signal, {
        onSources: (s) => setStreamingSources(s),
        onToken: (chunk) => setPartialAnswer((prev) => prev + chunk),
      })
    },
    enabled: activeQuery.length > 0,
    staleTime: ASK_STALE_MS,
    retry: false,
  })

  const [submissionCount, setSubmissionCount] = useState(0)

  const [rateLimitWaitSec, setRateLimitWaitSec] = useState<number | null>(null)

  useEffect(() => {
    if (
      askQuery.isError &&
      askQuery.error instanceof ChatAskError &&
      askQuery.error.retryAfterSec !== undefined
    ) {
      setRateLimitWaitSec(Math.max(0, Math.ceil(askQuery.error.retryAfterSec)))
    } else if (askQuery.isSuccess || askQuery.isPending) {
      setRateLimitWaitSec(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askQuery.errorUpdatedAt, askQuery.isError, askQuery.isSuccess, askQuery.isPending])

  useEffect(() => {
    if (rateLimitWaitSec === null || rateLimitWaitSec <= 0) return
    const id = setTimeout(() => {
      setRateLimitWaitSec((n) => (n === null ? null : n - 1))
    }, 1000)
    return () => clearTimeout(id)
  }, [rateLimitWaitSec])

  const isLoading = askQuery.isFetching
  // Once the backend has flushed the `sources` event the UI has enough
  // to render the partial answer + chip row together. Before that we
  // stay in the generic loading skeleton.
  const isStreaming = isLoading && streamingSources !== null

  const answerState: AnswerBlockState =
    activeQuery.length === 0
      ? { kind: 'idle' }
      : askQuery.isError
        ? { kind: 'error', error: askQuery.error }
        : askQuery.isSuccess
          ? { kind: 'success', response: askQuery.data }
          : isStreaming
            ? {
                kind: 'streaming',
                partialAnswer,
                sources: streamingSources ?? [],
              }
            : isLoading
              ? { kind: 'loading' }
              : { kind: 'idle' }

  function updateSearchParams(
    mutate: (next: URLSearchParams) => void,
    options: { replace: boolean },
  ): void {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next, { replace: options.replace })
  }

  const isRateLimited = rateLimitWaitSec !== null && rateLimitWaitSec > 0

  function runAsk(nextQuery: string): void {
    if (isRateLimited) return

    setDraftQuery(nextQuery)
    const isResubmit = nextQuery === activeQuery
    updateSearchParams(
      (next) => {
        next.set('q', nextQuery)
      },
      { replace: false },
    )
    setSubmissionCount((c) => c + 1)
    if (isResubmit) {
      void askQuery.refetch()
    }
  }

  function handleTileSelect(tileQuery: string): void {
    runAsk(tileQuery)
  }

  function handleRetry(): void {
    void askQuery.refetch()
  }

  function handleScopeChange(next: ChannelScopeValue): void {
    // Replace (don't push) — scope changes should not pollute history.
    updateSearchParams(
      (nextParams) => {
        nextParams.delete('channel')
        nextParams.delete('channels')
        const { channels } = serializeChannelScopeParam(next)
        if (channels) nextParams.set('channels', channels)
      },
      { replace: true },
    )
  }

  const tiles: PromptTileData[] = tilesQuery.data
    ? [...tilesQuery.data.current, ...tilesQuery.data.evergreen]
    : []

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold font-display">Search Chat</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ask the community anything. Semantic search across the group
          WhatsApp conversations with citations.
        </p>
      </header>

      <HeroAskCard
        scope={scope}
        onScopeChange={handleScopeChange}
        draftQuery={draftQuery}
        onDraftChange={setDraftQuery}
        onSubmit={runAsk}
        loading={isLoading}
        disabled={isRateLimited}
        disabledReason={
          isRateLimited ? `Retry in ${rateLimitWaitSec}s` : undefined
        }
      />

      <PromptChipRow
        tiles={tiles}
        loading={tilesQuery.isLoading}
        error={tilesQuery.isError}
        onSelect={handleTileSelect}
        disabled={askQuery.isFetching || isRateLimited}
      />

      <PrivacyNotice optedOut={optedOut} />

      {answerState.kind === 'idle' ? (
        <EmptyState />
      ) : (
        <AnswerBlock
          state={answerState}
          onRetry={handleRetry}
          focusKey={`${activeQuery}|${scopeKey}|${submissionCount}`}
          countdownRemaining={rateLimitWaitSec}
        />
      )}
    </div>
  )
}
