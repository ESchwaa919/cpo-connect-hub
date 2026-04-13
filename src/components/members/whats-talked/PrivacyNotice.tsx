import { Link } from 'react-router-dom'
import { Info, ShieldCheck } from 'lucide-react'

interface PrivacyNoticeProps {
  optedOut: boolean
}

export function PrivacyNotice({ optedOut }: PrivacyNoticeProps) {
  if (optedOut) {
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        data-testid="privacy-notice-opted-out"
      >
        <ShieldCheck
          className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
        <span>
          You have opted out of question logging. Manage in your{' '}
          <Link
            to="/members/profile#chat-search-privacy"
            className="underline underline-offset-2"
          >
            profile
          </Link>
          .
        </span>
      </p>
    )
  }

  return (
    <p
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      data-testid="privacy-notice-default"
    >
      <Info className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span>
        Questions may be logged to improve this feature. Opt out in your{' '}
        <Link
          to="/members/profile#chat-search-privacy"
          className="underline underline-offset-2"
        >
          profile
        </Link>
        .
      </span>
    </p>
  )
}
