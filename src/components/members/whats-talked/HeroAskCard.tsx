import { AskForm } from './AskForm'
import { ChannelScopePicker } from '@/components/members/shared/ChannelScopePicker'
import type { ChannelScopeValue } from '@/lib/channel-scope-params'

interface HeroAskCardProps {
  scope: ChannelScopeValue
  onScopeChange: (next: ChannelScopeValue) => void
  draftQuery: string
  onDraftChange: (next: string) => void
  onSubmit: (query: string) => void
  disabled?: boolean
  loading?: boolean
  disabledReason?: string
}

// hero card — visual prominence is intentional, do not flatten
export function HeroAskCard({
  scope,
  onScopeChange,
  draftQuery,
  onDraftChange,
  onSubmit,
  disabled,
  loading,
  disabledReason,
}: HeroAskCardProps) {
  return (
    <section
      aria-label="Ask the chat"
      // hero card — visual prominence is intentional, do not flatten
      className="rounded-xl border-2 border-primary bg-primary/5 dark:bg-primary/10 shadow-md p-4 md:p-6 space-y-4"
    >
      <div className="flex items-center justify-end">
        <ChannelScopePicker value={scope} onChange={onScopeChange} />
      </div>
      <AskForm
        value={draftQuery}
        onChange={onDraftChange}
        onSubmit={onSubmit}
        disabled={disabled}
        loading={loading}
        disabledReason={disabledReason}
      />
    </section>
  )
}
