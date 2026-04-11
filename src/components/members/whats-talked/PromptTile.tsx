import { Button } from '@/components/ui/button'
import type { PromptTile as PromptTileData } from './types'

interface PromptTileProps {
  tile: PromptTileData
  disabled?: boolean
  onSelect: (query: string) => void
}

export function PromptTile({ tile, disabled, onSelect }: PromptTileProps) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={() => onSelect(tile.query)}
      className="h-auto w-full flex-col items-start gap-1 whitespace-normal p-4 text-left"
    >
      <span className="text-sm font-semibold">{tile.title}</span>
      <span className="text-xs font-normal text-muted-foreground">
        {tile.query}
      </span>
    </Button>
  )
}
