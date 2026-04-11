import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ChannelTabs } from '@/components/members/whats-talked/ChannelTabs'
import { PromptTile } from '@/components/members/whats-talked/PromptTile'
import { AskForm } from '@/components/members/whats-talked/AskForm'
import {
  AnswerPanel,
  type AnswerPanelState,
} from '@/components/members/whats-talked/AnswerPanel'
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
  ALL_CHANNELS_ID,
  isChannelTabId,
  type ChannelTabId,
} from '@/constants/chatChannels'
import { useMemberProfile } from '@/hooks/useMemberProfile'

const ASK_STALE_MS = 5 * 60 * 1000
const TILES_STALE_MS = 60 * 60 * 1000

async function fetchPromptTiles(
  channel: ChannelTabId,
): Promise<PromptTilesResponse> {
  const qs =
    channel === ALL_CHANNELS_ID
      ? ''
      : `?channel=${encodeURIComponent(channel)}`
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
  channel: ChannelTabId,
  signal: AbortSignal,
): Promise<AskSuccessResponse> {
  const body: Record<string, unknown> = { query }
  if (channel !== ALL_CHANNELS_ID) body.channel = channel

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
    // Re-throw aborts as-is so React Query swallows them instead of
    // surfacing a generic 'internal' error when the user cancels.
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

  const channelParam = searchParams.get('channel')
  const channel: ChannelTabId = isChannelTabId(channelParam)
    ? channelParam
    : ALL_CHANNELS_ID
  const activeQuery = searchParams.get('q') ?? ''

  // Textarea draft is separate from activeQuery so typing doesn't re-key
  // the ask query. Submission moves the draft into the URL search param.
  const [draftQuery, setDraftQuery] = useState(activeQuery)

  // Keep the draft in sync when the URL changes under us (back/forward
  // navigation, or a parent link to /members/whats-talked?q=...).
  useEffect(() => {
    setDraftQuery(activeQuery)
  }, [activeQuery])

  const profileQuery = useMemberProfile()
  // Default to the standard disclosure if the profile fetch fails, so a
  // transient profile-lookup error never hides the required notice.
  const optedOut = profileQuery.data?.chat_query_logging_opted_out === true

  const tilesQuery = useQuery<PromptTilesResponse>({
    queryKey: ['chat-prompt-tiles', channel],
    queryFn: () => fetchPromptTiles(channel),
    staleTime: TILES_STALE_MS,
  })

  const askQuery = useQuery<AskSuccessResponse, ChatAskError>({
    queryKey: ['chat-ask', activeQuery, channel],
    queryFn: ({ signal }) => postAsk(activeQuery, channel, signal),
    enabled: activeQuery.length > 0,
    staleTime: ASK_STALE_MS,
    retry: false,
  })

  // Monotonic submission counter — feeds `focusKey` so consecutive
  // submits of the same query still move focus to the answer heading.
  const [submissionCount, setSubmissionCount] = useState(0)

  // Rate-limit countdown, lifted to the page level so AskForm and
  // AnswerPanel can both read it. Restarts whenever the ask query
  // produces a new error carrying a `retryAfterSec`.
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
    // `errorUpdatedAt` changes on every new error occurrence and is the
    // canonical signal — no need to also depend on `error` (ref-stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askQuery.errorUpdatedAt, askQuery.isError, askQuery.isSuccess, askQuery.isPending])

  useEffect(() => {
    if (rateLimitWaitSec === null || rateLimitWaitSec <= 0) return
    const id = setTimeout(() => {
      setRateLimitWaitSec((n) => (n === null ? null : n - 1))
    }, 1000)
    return () => clearTimeout(id)
  }, [rateLimitWaitSec])

  // Show the loading card whenever a request is in flight — including
  // the refetch() path. Users should see a spinner on every round-trip
  // to Gemini/Claude, not just the first one. We use `isFetching` (not
  // `isPending`) because a disabled query with no data reports
  // isPending=true even when no request is running.
  const isLoading = askQuery.isFetching

  const answerState: AnswerPanelState =
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
    // Honor an active rate-limit cooldown regardless of entry point
    // (AskForm submit, prompt tile click, retry button). Silent bail-out
    // — AskForm and the ErrorCard already show the visible countdown so
    // the user isn't confused about why nothing happened.
    if (isRateLimited) return

    setDraftQuery(nextQuery)
    // activeQuery is captured from the closed-over searchParams snapshot,
    // so this comparison is stable within the handler call.
    const isResubmit = nextQuery === activeQuery
    updateSearchParams(
      (next) => {
        next.set('q', nextQuery)
      },
      // Push a new history entry so the back button can step back through
      // prior questions the way the spec calls out.
      { replace: false },
    )
    // Bump the submission counter so focus moves to the answer heading
    // on every submit, including same-query resubmits where the query
    // key wouldn't otherwise change.
    setSubmissionCount((c) => c + 1)
    // Force a fresh network call when the query key won't change on its
    // own (e.g. re-asking the same question to pick up newly ingested
    // conversations). The 5-minute staleTime still serves the back
    // button and URL-restore cases where the user hasn't explicitly
    // submitted a new request.
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

  function handleChannelChange(next: ChannelTabId): void {
    // Replace (don't push) — tab clicks should not pollute history.
    updateSearchParams(
      (nextParams) => {
        if (next === ALL_CHANNELS_ID) {
          nextParams.delete('channel')
        } else {
          nextParams.set('channel', next)
        }
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
        <h1 className="text-3xl font-bold font-display">
          What's Everyone Talking About?
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ask the group chat anything. Search across the full community
          chat history with citations. Pick a channel to narrow the
          search or leave it on "All channels."
        </p>
      </header>

      <PrivacyNotice optedOut={optedOut} />

      <ChannelTabs value={channel} onChange={handleChannelChange} />

      <section aria-labelledby="prompt-tiles-heading" className="space-y-2">
        <h2
          id="prompt-tiles-heading"
          className="text-sm font-semibold text-muted-foreground"
        >
          Suggested prompts
        </h2>
        {tilesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading prompts…
          </div>
        ) : tilesQuery.isError ? (
          <p className="text-sm text-muted-foreground">
            Couldn't load suggested prompts. You can still type your own
            question below.
          </p>
        ) : tiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No suggested prompts for this channel. Type your own question
            below.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) => (
              <PromptTile
                key={tile.id}
                tile={tile}
                disabled={askQuery.isFetching || isRateLimited}
                onSelect={handleTileSelect}
              />
            ))}
          </div>
        )}
      </section>

      <AskForm
        value={draftQuery}
        onChange={setDraftQuery}
        onSubmit={runAsk}
        loading={isLoading}
        disabled={isRateLimited}
        disabledReason={
          isRateLimited ? `Retry in ${rateLimitWaitSec}s` : undefined
        }
      />

      {answerState.kind === 'idle' ? (
        <EmptyState />
      ) : (
        <AnswerPanel
          state={answerState}
          onRetry={handleRetry}
          focusKey={`${activeQuery}|${channel}|${submissionCount}`}
          countdownRemaining={rateLimitWaitSec}
        />
      )}
    </div>
  )
}
