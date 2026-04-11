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
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-mono">
            {source.id}
          </Badge>
          <span className="font-medium text-foreground">{displayName}</span>
          <span aria-hidden="true">·</span>
          <span>{labelForChannel(source.channel)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={source.sentAt}>{formatDate(source.sentAt)}</time>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {source.messageText}
        </p>
      </CardContent>
    </Card>
  )
}
