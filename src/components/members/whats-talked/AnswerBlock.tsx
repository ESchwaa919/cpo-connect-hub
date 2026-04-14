import { useEffect, useRef } from 'react'
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
import { SourceChip } from './SourceChip'
import { FeedbackRow } from './FeedbackRow'
import type { AskSuccessResponse, ChatAskError } from './types'

type AnswerBlockState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; response: AskSuccessResponse }
  | { kind: 'error'; error: ChatAskError }

interface AnswerBlockProps {
  state: AnswerBlockState
  onRetry: () => void
  /** Stable identifier for the current ask (parent derives from query +
   *  channel scope + submission counter). Changes ⇒ focus moves to the
   *  terminal-state heading so keyboard and screen-reader users land on
   *  the new response, even on same-query resubmits. */
  focusKey: string
  /** Seconds remaining on the shared rate-limit countdown, or null when
   *  no cooldown is active. Lifted to the parent so both AskForm and
   *  AnswerBlock show the same value. */
  countdownRemaining: number | null
}

export type { AnswerBlockState }

export function AnswerBlock({
  state,
  onRetry,
  focusKey,
  countdownRemaining,
}: AnswerBlockProps) {
  const successHeadingRef = useRef<HTMLHeadingElement>(null)
  const zeroMatchHeadingRef = useRef<HTMLHeadingElement>(null)
  const errorHeadingRef = useRef<HTMLHeadingElement>(null)
  const lastFocusedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (state.kind === 'idle' || state.kind === 'loading') return
    if (lastFocusedKeyRef.current === focusKey) return
    lastFocusedKeyRef.current = focusKey

    let target: HTMLHeadingElement | null = null
    if (state.kind === 'success') {
      target =
        state.response.answer !== null
          ? successHeadingRef.current
          : zeroMatchHeadingRef.current
    } else if (state.kind === 'error') {
      target = errorHeadingRef.current
    }
    target?.focus()
  }, [state, focusKey])

  const isLoading = state.kind === 'loading'

  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading ? <LoadingCard /> : null}
      {state.kind === 'error' ? (
        <ErrorCard
          error={state.error}
          onRetry={onRetry}
          countdownRemaining={countdownRemaining}
          headingRef={errorHeadingRef}
        />
      ) : null}
      {state.kind === 'success' ? (
        state.response.answer === null ? (
          <ZeroMatchCard
            message={state.response.message}
            headingRef={zeroMatchHeadingRef}
          />
        ) : (
          <SuccessBody
            response={state.response}
            headingRef={successHeadingRef}
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
  headingRef,
}: {
  response: AskSuccessResponse
  headingRef: React.RefObject<HTMLHeadingElement | null>
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-3">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase focus:outline-none"
          >
            Answer
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {response.answer}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {response.model ? <span>Model: {response.model}</span> : null}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {Math.round(response.queryMs)} ms
              </span>
            </div>
            <FeedbackRow queryLogId={response.queryLogId ?? null} />
          </div>
        </div>
        {response.sources.length > 0 ? (
          <div className="pt-4 border-t border-dashed border-border space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Sources · {response.sources.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {response.sources.map((s) => (
                <SourceChip key={s.id} source={s} />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ZeroMatchCard({
  message,
  headingRef,
}: {
  message?: string
  headingRef: React.RefObject<HTMLHeadingElement | null>
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
        <MessageCircleQuestion className="h-8 w-8 text-muted-foreground" />
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-sm font-semibold focus:outline-none"
        >
          No relevant history found
        </h3>
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
  countdownRemaining,
  headingRef,
}: {
  error: ChatAskError
  onRetry: () => void
  countdownRemaining: number | null
  headingRef: React.RefObject<HTMLHeadingElement | null>
}) {
  const details = explainError(error)
  const hasCountdown = details.retryAfterSec !== undefined
  const locked =
    hasCountdown && countdownRemaining !== null && countdownRemaining > 0
  return (
    <Card className="border-destructive/40 bg-destructive/5" role="alert">
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="h-5 w-5 flex-shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="text-sm font-semibold text-foreground focus:outline-none"
            >
              {details.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{details.body}</p>
          </div>
        </div>
        {hasCountdown ? (
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={locked}
              onClick={onRetry}
            >
              {locked ? (
                <>
                  <TimerReset className="mr-2 h-4 w-4" />
                  Retry in {countdownRemaining}s
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </>
              )}
            </Button>
          </div>
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
