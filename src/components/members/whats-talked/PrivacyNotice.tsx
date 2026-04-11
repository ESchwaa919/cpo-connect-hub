import { Link } from 'react-router-dom'
import { Info, ShieldCheck } from 'lucide-react'

interface PrivacyNoticeProps {
  optedOut: boolean
}

export function PrivacyNotice({ optedOut }: PrivacyNoticeProps) {
  if (optedOut) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-foreground"
        data-testid="privacy-notice-opted-out"
      >
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>
          You have opted out of question logging. Your questions will still
          be answered but the text will not be stored in event logs. You can
          change this in your{' '}
          <Link to="/members/profile" className="underline underline-offset-2">
            profile
          </Link>
          .
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex items-start gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
      data-testid="privacy-notice-default"
    >
      <Info className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>
        We may log the text of your questions to improve this feature. You
        can opt out in your{' '}
        <Link to="/members/profile" className="underline underline-offset-2">
          profile
        </Link>
        .
      </span>
    </div>
  )
}
