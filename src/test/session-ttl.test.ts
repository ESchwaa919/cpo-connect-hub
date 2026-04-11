// Side-effect import: seeds RESEND_API_KEY dummy so email.ts's eager
// `new Resend(...)` construction doesn't throw when auth.ts is imported.
import './_requireIngestAuth-setup'

// Regression test for THE-551 — session TTL.
//
// Both the signed-cookie `Max-Age` (cookie path) and the
// `cpo_connect.sessions.expires_at` DB column (row path) must stay in
// sync. Historically they were both 7 days, which caused members to be
// kicked back to the magic-link flow every time they opened a new
// browser window after a week. 30 days is the new floor. This test
// locks the two constants together so a future edit can't drift one
// without the other.
import { describe, it, expect } from 'vitest'
import {
  SESSION_TTL_MS,
  SESSION_TTL_SQL_INTERVAL,
} from '../../server/routes/auth'

describe('session TTL (THE-551)', () => {
  it('SESSION_TTL_MS is 30 days in milliseconds', () => {
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it('SESSION_TTL_SQL_INTERVAL is "30 days" to match the cookie Max-Age', () => {
    expect(SESSION_TTL_SQL_INTERVAL).toBe('30 days')
  })

  it('both constants reference the same 30-day window', () => {
    // The cookie Max-Age (ms) and the DB INTERVAL (Postgres text) must
    // express the same lifetime so a valid cookie never points at an
    // already-expired session row.
    const msFromInterval =
      Number(SESSION_TTL_SQL_INTERVAL.replace(/\D/g, '')) *
      24 *
      60 *
      60 *
      1000
    expect(msFromInterval).toBe(SESSION_TTL_MS)
  })
})
