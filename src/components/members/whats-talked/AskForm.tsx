import { type FormEvent, type KeyboardEvent } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const MAX_QUERY_LENGTH = 500

interface AskFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (query: string) => void
  disabled?: boolean
  loading?: boolean
  /** Human-readable reason to show next to the submit button when the
   *  form is disabled for an external reason (e.g. rate-limit cooldown
   *  "Retry in 3s"). Also replaces the submit button label text. */
  disabledReason?: string
}

export function AskForm({
  value,
  onChange,
  onSubmit,
  disabled,
  loading,
  disabledReason,
}: AskFormProps) {
  const trimmed = value.trim()
  const tooLong = trimmed.length > MAX_QUERY_LENGTH
  const isLocked = disabled === true || loading === true
  const canSubmit = !isLocked && trimmed.length > 0 && !tooLong

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    if (canSubmit) onSubmit(trimmed)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter submits; Shift+Enter inserts a newline for multi-line questions.
    if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
      e.preventDefault()
      onSubmit(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask the group chat anything... (Enter to submit, Shift+Enter for a new line)"
        rows={3}
        maxLength={MAX_QUERY_LENGTH * 2}
        disabled={isLocked}
        aria-disabled={isLocked}
        aria-label="Your question for the group chat"
        aria-invalid={tooLong}
        className="resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={
            tooLong
              ? 'text-xs font-medium text-destructive'
              : 'text-xs text-muted-foreground'
          }
          aria-live="polite"
        >
          {tooLong
            ? `Too long — ${trimmed.length}/${MAX_QUERY_LENGTH} characters`
            : `${trimmed.length}/${MAX_QUERY_LENGTH}`}
        </span>
        <Button type="submit" disabled={!canSubmit} size="sm">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching…
            </>
          ) : disabledReason ? (
            disabledReason
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Ask
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
