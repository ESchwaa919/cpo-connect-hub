import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  labelForChannelScope,
  type ChannelId,
  type ChannelScopeValue,
} from '@/lib/channel-scope-params'

interface ChannelScopePickerProps {
  value: ChannelScopeValue
  onChange: (next: ChannelScopeValue) => void
  allowMultiSelect?: boolean
  showAllOption?: boolean
  className?: string
}

export function ChannelScopePicker({
  value,
  onChange,
  allowMultiSelect = true,
  showAllOption = true,
  className,
}: ChannelScopePickerProps) {
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

  const label = labelForChannelScope(value)
  const isAll = value.mode === 'all'
  const selectedIds = new Set<ChannelId>(value.ids)

  function handleAllClick() {
    onChange({ mode: 'all', ids: [...ALL_CHANNELS] })
  }

  function handleChannelClick(id: ChannelId) {
    if (!allowMultiSelect) {
      if (value.mode === 'subset' && value.ids.length === 1 && value.ids[0] === id) {
        return
      }
      onChange({ mode: 'subset', ids: [id] })
      return
    }
    // Picking an individual channel while in "all" mode focuses the scope
    // on just that channel. The "All channels" row is the explicit way to
    // re-expand — this avoids the ambiguous "untoggle one from all" UX.
    if (isAll) {
      onChange({ mode: 'subset', ids: [id] })
      return
    }
    if (selectedIds.has(id)) {
      const nextIds = value.ids.filter((c) => c !== id)
      if (nextIds.length === 0) return
      onChange({ mode: 'subset', ids: nextIds })
      return
    }
    const nextIds = ALL_CHANNELS.filter((c) => selectedIds.has(c) || c === id)
    if (nextIds.length === ALL_CHANNELS.length) {
      onChange({ mode: 'all', ids: [...ALL_CHANNELS] })
      return
    }
    onChange({ mode: 'subset', ids: nextIds })
  }

  const itemRole: 'menuitemcheckbox' | 'menuitemradio' = allowMultiSelect
    ? 'menuitemcheckbox'
    : 'menuitemradio'

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Channel scope"
          className="absolute right-0 z-50 mt-2 min-w-[14rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {showAllOption && allowMultiSelect && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isAll}
              onClick={handleAllClick}
              className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            >
              {isAll && (
                <Check
                  className="absolute left-2 h-4 w-4"
                  aria-hidden="true"
                />
              )}
              All channels
            </button>
          )}
          {ALL_CHANNELS.map((id) => {
            const checked = isAll || selectedIds.has(id)
            return (
              <button
                type="button"
                key={id}
                role={itemRole}
                aria-checked={checked}
                onClick={() => handleChannelClick(id)}
                className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              >
                {checked && (
                  <Check
                    className="absolute left-2 h-4 w-4"
                    aria-hidden="true"
                  />
                )}
                {CHANNEL_LABELS[id]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
