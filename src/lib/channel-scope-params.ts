export const ALL_CHANNELS = ['general', 'ai', 'leadership'] as const
export type ChannelId = (typeof ALL_CHANNELS)[number]

export type ChannelScopeValue =
  | { mode: 'all'; ids: ChannelId[] }
  | { mode: 'subset'; ids: ChannelId[] }

const CHANNEL_LABELS: Record<ChannelId, string> = {
  general: 'General',
  ai: 'AI',
  leadership: 'Leadership',
}

function isChannelId(x: string): x is ChannelId {
  return (ALL_CHANNELS as readonly string[]).includes(x)
}

/** Parse `?channels=a,b,c`, `?channels=all`, or legacy `?channel=foo`
 *  into a ChannelScopeValue. Absent or unparseable values fall back
 *  to the all-channels sentinel. A subset that equals every channel
 *  collapses to `all` so round-tripping stays stable. */
export function parseChannelScopeParam(
  search: URLSearchParams,
): ChannelScopeValue {
  const plural = search.get('channels')
  if (plural !== null) {
    if (plural === 'all' || plural === '') {
      return { mode: 'all', ids: [...ALL_CHANNELS] }
    }
    const ids = plural
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .filter(isChannelId)
    if (ids.length === 0 || ids.length === ALL_CHANNELS.length) {
      return { mode: 'all', ids: [...ALL_CHANNELS] }
    }
    return { mode: 'subset', ids }
  }
  const legacy = search.get('channel')
  if (legacy !== null && isChannelId(legacy)) {
    return { mode: 'subset', ids: [legacy] }
  }
  return { mode: 'all', ids: [...ALL_CHANNELS] }
}

export function serializeChannelScopeParam(
  value: ChannelScopeValue,
): { channels?: string } {
  if (value.mode === 'all') return {}
  return { channels: value.ids.join(',') }
}

/** Human-readable label for the current scope. Follows the spec copy:
 *  "All 3 channels" / "General only" / "AI + Leadership" / "3 channels".
 *  Channel order in the "A + B" form follows ALL_CHANNELS order so the
 *  label is stable across re-renders. */
export function labelForChannelScope(value: ChannelScopeValue): string {
  if (value.mode === 'all') return `All ${ALL_CHANNELS.length} channels`
  if (value.ids.length === 1) {
    return `${CHANNEL_LABELS[value.ids[0]]} only`
  }
  const ordered = ALL_CHANNELS.filter((c) => value.ids.includes(c))
  if (ordered.length === 2) {
    return `${CHANNEL_LABELS[ordered[0]]} + ${CHANNEL_LABELS[ordered[1]]}`
  }
  return `${ordered.length} channels`
}
