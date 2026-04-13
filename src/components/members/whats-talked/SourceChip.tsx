import { useEffect, useRef, useState } from 'react'
import { Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AskSource } from './types'

const CHANNEL_LABEL: Record<string, string> = {
  general: 'General',
  ai: 'AI',
  leadership: 'L&C',
  leadership_culture: 'L&C',
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

const MAX_POPOVER_CHARS = 300

export function SourceChip({ source }: { source: AskSource }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const displayName = source.authorOptedOut ? 'A member' : source.authorDisplayName
  const channelLabel = CHANNEL_LABEL[source.channel] ?? source.channel
  const shortDate = formatShortDate(source.sentAt)
  const excerpt =
    source.messageText.length > MAX_POPOVER_CHARS
      ? source.messageText.slice(0, MAX_POPOVER_CHARS) + '…'
      : source.messageText

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Source ${source.id} from ${displayName} in ${channelLabel} on ${shortDate}`}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs',
          'bg-primary/10 text-primary hover:bg-primary/20',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'transition-colors',
        )}
      >
        <Hash className="h-3 w-3" aria-hidden="true" />
        <span className="font-medium">{displayName}</span>
        <span className="opacity-60" aria-hidden="true">·</span>
        <span>{channelLabel}</span>
        <span className="opacity-60" aria-hidden="true">·</span>
        <time dateTime={source.sentAt}>{shortDate}</time>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Source ${source.id} details`}
          className="absolute left-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
            <span className="font-medium text-foreground">{displayName}</span>
            <span aria-hidden="true">·</span>
            <span>{channelLabel}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={source.sentAt}>{shortDate}</time>
          </div>
          <p
            data-testid="source-chip-popover-body"
            className="whitespace-pre-wrap leading-relaxed"
          >
            {excerpt}
          </p>
        </div>
      )}
    </div>
  )
}
