import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Clock,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  TimerReset,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SourceCard } from './SourceCard'
import type { AskSuccessResponse, ChatAskError } from './types'

type AnswerPanelState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; response: AskSuccessResponse }
  | { kind: 'error'; error: ChatAskError }

interface AnswerPanelProps {
  state: AnswerPanelState
  onRetry: () => void
  /** Stable identifier for the current ask (parent derives from query +
   *  channel). Changes ⇒ focus moves to the answer heading so keyboard
   *  and screen-reader users land on the new response. Same value ⇒
   *  focus stays wherever the user moved it. */
  focusKey: string
}

export type { AnswerPanelState }

export function AnswerPanel({ state, onRetry, focusKey }: AnswerPanelProps) {
  const answerHeadingRef = useRef<HTMLHeadingElement>(null)
  const lastFocusedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (
      state.kind === 'success' &&
      state.response.answer !== null &&
      lastFocusedKeyRef.current !== focusKey
    ) {
      lastFocusedKeyRef.current = focusKey
      answerHeadingRef.current?.focus()
    }
  }, [state, focusKey])

  const isLoading = state.kind === 'loading'

  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading ? <LoadingCard /> : null}
      {state.kind === 'error' ? (
        <ErrorCard error={state.error} onRetry={onRetry} />
      ) : null}
      {state.kind === 'success' ? (
        state.response.answer === null ? (
          <ZeroMatchCard message={state.response.message} />
        ) : (
          <SuccessBody
            response={state.response}
            answerHeadingRef={answerHeadingRef}
          />
        )
      ) : null}
    </div>
  )
}

function LoadingCard() {
  return (
    <Card className="border-dashed" role="status">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching chat history and synthesizing an answer…
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </CardContent>
    </Card>
  )
}

function SuccessBody({
  response,
  answerHeadingRef,
}: {
  response: AskSuccessResponse
  answerHeadingRef: React.RefObject<HTMLHeadingElement | null>
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-6">
          <h3
            ref={answerHeadingRef}
            tabIndex={-1}
            className="text-sm font-semibold text-muted-foreground focus:outline-none"
          >
            Answer
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {response.answer}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {response.model ? <span>Model: {response.model}</span> : null}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {Math.round(response.queryMs)} ms
            </span>
          </div>
        </CardContent>
      </Card>

      {response.sources.length > 0 ? (
        <section aria-labelledby="sources-heading" className="space-y-2">
          <h3
            id="sources-heading"
            className="text-sm font-semibold text-muted-foreground"
          >
            Sources ({response.sources.length})
          </h3>
          <div className="space-y-2">
            {response.sources.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ZeroMatchCard({ message }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
        <MessageCircleQuestion className="h-8 w-8 text-muted-foreground" />
        <h3 className="text-sm font-semibold">No relevant history found</h3>
        <p className="max-w-md text-xs text-muted-foreground">
          {message ??
            'No messages in the indexed chat history matched this question. Try rephrasing or switching to a different channel.'}
        </p>
      </CardContent>
    </Card>
  )
}

function ErrorCard({
  error,
  onRetry,
}: {
  error: ChatAskError
  onRetry: () => void
}) {
  const details = explainError(error)
  return (
    <Card className="border-destructive/50 bg-destructive/5" role="alert">
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="h-5 w-5 flex-shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              {details.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {details.body}
            </p>
          </div>
        </div>
        {details.retryAfterSec !== undefined ? (
          <RetryCountdown seconds={details.retryAfterSec} onRetry={onRetry} />
        ) : details.canRetry ? (
          <div>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface ErrorDetails {
  title: string
  body: string
  canRetry: boolean
  retryAfterSec?: number
}

function explainError(err: ChatAskError): ErrorDetails {
  switch (err.code) {
    case 'rate_limited':
      return {
        title: 'Rate limit reached',
        body:
          'You have asked a lot of questions recently. Please wait before trying again.',
        canRetry: true,
        retryAfterSec: err.retryAfterSec,
      }
    case 'embedding_unavailable':
      return {
        title: 'Search temporarily unavailable',
        body:
          'The embedding service is momentarily unavailable. This usually clears up quickly.',
        canRetry: true,
        retryAfterSec: err.retryAfterSec,
      }
    case 'synthesis_unavailable':
      return {
        title: 'Answer service temporarily unavailable',
        body:
          'Found relevant messages, but the answer-synthesis service is momentarily unavailable. Try again in a moment.',
        canRetry: true,
      }
    case 'bad_query':
      return {
        title: "That question couldn't be processed",
        body:
          'Your question was empty, too long (max 500 characters), or contained an invalid date. Please revise and try again.',
        canRetry: false,
      }
    case 'internal':
    default:
      return {
        title: 'Something went wrong',
        body:
          'An unexpected error occurred on the server. Please try again — if the problem persists, let an admin know.',
        canRetry: true,
      }
  }
}

function RetryCountdown({
  seconds,
  onRetry,
}: {
  seconds: number
  onRetry: () => void
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil(seconds)),
  )

  useEffect(() => {
    setRemaining(Math.max(0, Math.ceil(seconds)))
  }, [seconds])

  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={remaining > 0}
        onClick={onRetry}
      >
        {remaining > 0 ? (
          <>
            <TimerReset className="mr-2 h-4 w-4" />
            Retry in {remaining}s
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </>
        )}
      </Button>
    </div>
  )
}
