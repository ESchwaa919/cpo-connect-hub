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
}

export function AskForm({
  value,
  onChange,
  onSubmit,
  disabled,
  loading,
}: AskFormProps) {
  const trimmed = value.trim()
  const tooLong = trimmed.length > MAX_QUERY_LENGTH
  const canSubmit = !disabled && !loading && trimmed.length > 0 && !tooLong

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    if (canSubmit) onSubmit(trimmed)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
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
        placeholder="Ask the group chat anything... (e.g. 'What have people said about hiring senior PMs?')"
        rows={3}
        maxLength={MAX_QUERY_LENGTH * 2}
        disabled={disabled || loading}
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
