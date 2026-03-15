import { Badge } from '@/components/ui/badge'

type TagVariant = 'hot' | 'green' | 'gold' | 'amber' | 'pink' | 'blue'

interface TrendItemProps {
  rank: number
  title: string
  description: string
  tags?: { label: string; variant: TagVariant }[]
  dateRange?: string
}

const tagColors: Record<TagVariant, string> = {
  hot: 'border-red-500/50 text-red-400 bg-red-500/10',
  green: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
  gold: 'border-amber-400/50 text-amber-300 bg-amber-400/10',
  amber: 'border-orange-500/50 text-orange-400 bg-orange-500/10',
  pink: 'border-pink-500/50 text-pink-400 bg-pink-500/10',
  blue: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
}

export function TrendItem({
  rank,
  title,
  description,
  tags,
  dateRange,
}: TrendItemProps) {
  return (
    <div className="flex gap-4 rounded-r-lg border-l-[3px] border-l-purple-600 bg-purple-500/5 p-4">
      <span className="text-2xl font-bold text-muted-foreground/40 select-none">
        {rank}
      </span>
      <div className="flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-purple-300">{title}</span>
          {tags?.map((tag) => (
            <Badge
              key={tag.label}
              variant="outline"
              className={tagColors[tag.variant]}
            >
              {tag.label}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        {dateRange && (
          <p className="text-xs text-muted-foreground/60">{dateRange}</p>
        )}
      </div>
    </div>
  )
}
