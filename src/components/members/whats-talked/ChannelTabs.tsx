import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ALL_CHANNELS_ID,
  CHAT_CHANNELS,
  type ChannelTabId,
} from '@/constants/chatChannels'

interface ChannelTabsProps {
  value: ChannelTabId
  onChange: (value: ChannelTabId) => void
}

export function ChannelTabs({ value, onChange }: ChannelTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as ChannelTabId)}
      className="w-full"
    >
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value={ALL_CHANNELS_ID}>
          All {CHAT_CHANNELS.length} channels
        </TabsTrigger>
        {CHAT_CHANNELS.map((c) => (
          <TabsTrigger key={c.id} value={c.id}>
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
