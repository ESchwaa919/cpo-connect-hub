import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { labelForChannel } from '@/constants/chatChannels'
import type { AskSource } from './types'

interface SourceCardProps {
  source: AskSource
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function SourceCard({ source }: SourceCardProps) {
  // Defense-in-depth: belt-and-braces redaction for opted-out authors.
  const displayName = source.authorOptedOut
    ? 'A member'
    : source.authorDisplayName
  const channelLabel = labelForChannel(source.channel)
  const formattedDate = formatDate(source.sentAt)
  const ariaLabel = `Source ${source.id} from ${displayName} in ${channelLabel}, ${formattedDate}`
  return (
    <Card
      tabIndex={0}
      role="article"
      aria-label={ariaLabel}
      className="overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-mono">
            {source.id}
          </Badge>
          <span className="font-medium text-foreground">{displayName}</span>
          <span aria-hidden="true">·</span>
          <span>{channelLabel}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={source.sentAt}>{formattedDate}</time>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {source.messageText}
        </p>
      </CardContent>
    </Card>
  )
}
