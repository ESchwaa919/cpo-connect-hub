import pool from '../db.ts'

/** Fire-and-forget event logging. Never throws. */
export function trackEvent(
  event: string,
  email?: string,
  metadata?: Record<string, unknown>,
): void {
  pool
    .query(
      'INSERT INTO cpo_connect.events (event, email, metadata) VALUES ($1, $2, $3)',
      [event, email ?? null, metadata ? JSON.stringify(metadata) : '{}'],
    )
    .catch((err) => {
      console.error('[analytics] Failed to log event:', event, (err as Error).message)
    })
}
