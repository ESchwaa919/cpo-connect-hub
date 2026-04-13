import { useEffect, useState } from 'react'
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
  type AskSuccessResponse,
  type ChatErrorResponse,
  type PromptTile as PromptTileData,
  type PromptTilesResponse,
} from '@/components/members/whats-talked/types'
import {
  parseChannelScopeParam,
  serializeChannelScopeParam,
  type ChannelScopeValue,
} from '@/lib/channel-scope-params'
import { useMemberProfile } from '@/hooks/useMemberProfile'

const ASK_STALE_MS = 5 * 60 * 1000
const TILES_STALE_MS = 60 * 60 * 1000

function scopeQueryString(scope: ChannelScopeValue): string {
  if (scope.mode === 'all') return ''
  if (scope.ids.length === 1) return `?channel=${encodeURIComponent(scope.ids[0])}`
  return `?channels=${encodeURIComponent(scope.ids.join(','))}`
}

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

async function postAsk(
  query: string,
  scope: ChannelScopeValue,
  signal: AbortSignal,
): Promise<AskSuccessResponse> {
  const body: Record<string, unknown> = { query }
  if (scope.mode === 'subset') {
    // Send either `channels: string[]` (multi) or a single `channel` for
    // single-select (matches the legacy field the server still accepts).
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

  if (res.ok) {
    return (await res.json()) as AskSuccessResponse
  }

  let payload: ChatErrorResponse | null = null
  try {
    payload = (await res.json()) as ChatErrorResponse
  } catch {
    /* non-JSON error body — fall through to 'internal' default below */
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

export default function WhatsTalked() {
  const [searchParams, setSearchParams] = useSearchParams()

  const scope: ChannelScopeValue = parseChannelScopeParam(searchParams)
  const scopeKey = scopeQueryString(scope)
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

  const askQuery = useQuery<AskSuccessResponse, ChatAskError>({
    queryKey: ['chat-ask', activeQuery, scopeKey],
    queryFn: ({ signal }) => postAsk(activeQuery, scope, signal),
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

  const answerState: AnswerBlockState =
    activeQuery.length === 0
      ? { kind: 'idle' }
      : isLoading
        ? { kind: 'loading' }
        : askQuery.isError
          ? { kind: 'error', error: askQuery.error }
          : askQuery.isSuccess
            ? { kind: 'success', response: askQuery.data }
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
