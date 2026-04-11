import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { ChannelTabs } from '@/components/members/whats-talked/ChannelTabs'
import { PromptTile } from '@/components/members/whats-talked/PromptTile'
import { AskForm } from '@/components/members/whats-talked/AskForm'
import {
  AnswerPanel,
  type AnswerPanelState,
} from '@/components/members/whats-talked/AnswerPanel'
import { EmptyState } from '@/components/members/whats-talked/EmptyState'
import {
  ChatAskError,
  type AskSuccessResponse,
  type ChatErrorResponse,
  type PromptTile as PromptTileData,
  type PromptTilesResponse,
} from '@/components/members/whats-talked/types'
import {
  ALL_CHANNELS_ID,
  type ChannelTabId,
} from '@/constants/chatChannels'

async function fetchPromptTiles(
  channel: ChannelTabId,
): Promise<PromptTilesResponse> {
  const qs = channel === ALL_CHANNELS_ID ? '' : `?channel=${encodeURIComponent(channel)}`
  const res = await fetch(`/api/chat/prompt-tiles${qs}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Failed to load prompt tiles (${res.status})`)
  }
  return (await res.json()) as PromptTilesResponse
}

interface AskVariables {
  query: string
  channel: ChannelTabId
}

async function postAsk({
  query,
  channel,
}: AskVariables): Promise<AskSuccessResponse> {
  const body: Record<string, unknown> = { query }
  if (channel !== ALL_CHANNELS_ID) body.channel = channel

  let res: Response
  try {
    res = await fetch('/api/chat/ask', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
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
  // Prefer the JSON body's retryAfterSec; fall back to the Retry-After
  // HTTP header so a backend that omits the field still drives the
  // countdown correctly.
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
  const [channel, setChannel] = useState<ChannelTabId>(ALL_CHANNELS_ID)
  const [query, setQuery] = useState('')

  const tilesQuery = useQuery<PromptTilesResponse>({
    queryKey: ['chat-prompt-tiles', channel],
    queryFn: () => fetchPromptTiles(channel),
  })

  const askMutation = useMutation<AskSuccessResponse, ChatAskError, AskVariables>(
    { mutationFn: postAsk },
  )

  const answerState: AnswerPanelState = askMutation.isPending
    ? { kind: 'loading' }
    : askMutation.isError
      ? { kind: 'error', error: askMutation.error }
      : askMutation.isSuccess
        ? { kind: 'success', response: askMutation.data }
        : { kind: 'idle' }

  function runAsk(nextQuery: string): void {
    askMutation.mutate({ query: nextQuery, channel })
  }

  function handleTileSelect(tileQuery: string): void {
    setQuery(tileQuery)
    runAsk(tileQuery)
  }

  function handleRetry(): void {
    if (askMutation.variables) askMutation.mutate(askMutation.variables)
  }

  function handleChannelChange(next: ChannelTabId): void {
    setChannel(next)
    askMutation.reset()
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
                disabled={askMutation.isPending}
                onSelect={handleTileSelect}
              />
            ))}
          </div>
        )}
      </section>

      <AskForm
        value={query}
        onChange={setQuery}
        onSubmit={runAsk}
        loading={askMutation.isPending}
      />

      {answerState.kind === 'idle' ? (
        <EmptyState />
      ) : (
        <AnswerPanel state={answerState} onRetry={handleRetry} />
      )}
    </div>
  )
}
