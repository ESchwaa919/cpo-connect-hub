import { Lightbulb } from 'lucide-react'
import type { PromptTile as PromptTileData } from './types'

interface PromptChipRowProps {
  tiles: PromptTileData[]
  loading?: boolean
  error?: boolean
  onSelect: (query: string) => void
  disabled?: boolean
}

export function PromptChipRow({
  tiles,
  loading,
  error,
  onSelect,
  disabled,
}: PromptChipRowProps) {
  if (loading) {
    return (
      <div
        className="flex flex-wrap gap-2"
        aria-label="Loading suggested prompts"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-32 rounded-full bg-muted animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-xs text-muted-foreground">
        Couldn't load suggested prompts — type your own question above.
      </p>
    )
  }

  if (tiles.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Try asking:</p>
      <div className="flex flex-wrap gap-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(tile.query)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-muted hover:bg-muted/80 border border-transparent hover:border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{tile.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
