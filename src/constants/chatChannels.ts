// WETA ("What's Everyone Talking About") channel constants. Scoped to
// the members chat-ask UI only — the existing landing-page
// ChannelsSection.tsx and src/data/insights/* intentionally keep their
// own unrelated channel lists and must not be refactored against this.

export type ChatChannelId = 'ai' | 'general' | 'leadership_culture'

export interface ChatChannel {
  id: ChatChannelId
  label: string
  description: string
}

export const CHAT_CHANNELS: readonly ChatChannel[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Community-wide discussion',
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'AI tooling, debates, and experiments',
  },
  {
    id: 'leadership_culture',
    label: 'Leadership & Culture',
    description: 'People, process, and leadership challenges',
  },
] as const

/** Sentinel id for the "all channels" tab. Not a real channel — when
 *  selected, the frontend omits the `channel` field from the request so
 *  the backend searches across every channel. */
export const ALL_CHANNELS_ID = 'all' as const
export type ChannelTabId = typeof ALL_CHANNELS_ID | ChatChannelId

export function labelForChannel(id: string): string {
  return CHAT_CHANNELS.find((c) => c.id === id)?.label ?? id
}
