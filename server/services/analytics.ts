import pool from '../db.ts'

export const AnalyticsEvent = {
  LOGIN_REQUEST: 'login_request',
  LOGIN_SUCCESS: 'login_success',
  LOGOUT: 'logout',
  PROFILE_VIEW: 'profile_view',
  PROFILE_UPDATE: 'profile_update',
  DIRECTORY_VIEW: 'directory_view',
  // Basic user tracking: one row per SPA route change (path in metadata).
  // Emitted by POST /api/events/page-view; email is the session email when
  // authenticated, NULL for anonymous visits.
  PAGE_VIEW: 'page_view',
  // WETA: full query text logged by default
  CHAT_QUERY: 'chat_query',
  // WETA: emitted instead of CHAT_QUERY when the member has opted out of
  // query text logging — metadata carries char_count + channel + limit only
  CHAT_QUERY_REDACTED: 'chat_query_redacted',
} as const

type EventName = typeof AnalyticsEvent[keyof typeof AnalyticsEvent]

/** Fire-and-forget event logging. Never throws. */
export function trackEvent(
  event: EventName,
  email?: string,
  metadata?: Record<string, unknown>,
): void {
  pool
    .query(
      'INSERT INTO cpo_connect.events (event, email, metadata) VALUES ($1, $2, $3)',
      [event, email ?? null, metadata ?? null],
    )
    .catch((err) => {
      console.error('[analytics] Failed to log event:', event, (err as Error).message)
    })
}
