import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FeedbackRowProps {
  /** query_log_id from the successful ask response. Null when the
   *  server-side log insert failed — in that case the buttons render
   *  disabled so the user gets visual feedback that rating isn't
   *  available for this particular query. */
  queryLogId: string | null
}

type Rating = 'thumbs_up' | 'thumbs_down'

export function FeedbackRow({ queryLogId }: FeedbackRowProps) {
  const [submitted, setSubmitted] = useState<Rating | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(rating: Rating): Promise<void> {
    if (submitted || pending || !queryLogId) return
    setPending(true)
    try {
      const res = await fetch('/api/chat/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryLogId, rating }),
      })
      if (res.ok) setSubmitted(rating)
    } catch {
      /* swallow — user can retry by clicking again */
    } finally {
      setPending(false)
    }
  }

  if (submitted) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        data-testid="feedback-submitted"
      >
        <Check className="h-3 w-3" aria-hidden="true" />
        Thanks for the feedback
      </div>
    )
  }

  const disabled = pending || !queryLogId
  return (
    <div className="flex items-center gap-2" data-testid="feedback-row">
      <span className="text-xs text-muted-foreground">Was this helpful?</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => submit('thumbs_up')}
        aria-label="Mark answer as helpful"
      >
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => submit('thumbs_down')}
        aria-label="Mark answer as not helpful"
      >
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}
