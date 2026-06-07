// Imported first for its side effects — loads .env and normalizes
// DATABASE_URL before pool is constructed via the downstream import.
import './_requireIngestAuth-setup'

import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import pool from '../../server/db'
import { pageViewHandler, toPathname } from '../../server/routes/events'
import { makeReq, makeRes } from './_express-mocks'

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

// Pure sanitization unit tests — no DB needed. These guard the magic-link
// token leak requirement: query strings and fragments must never survive.
describe('toPathname', () => {
  it('keeps a plain root-relative path', () => {
    expect(toPathname('/members/directory')).toBe('/members/directory')
  })

  it('strips the query string (no magic-link token can be stored)', () => {
    expect(toPathname('/api/auth/verify?token=secret-abc123')).toBe(
      '/api/auth/verify',
    )
  })

  it('strips the fragment', () => {
    expect(toPathname('/members/whats-talked#events')).toBe(
      '/members/whats-talked',
    )
  })

  it('drops the host from a protocol-relative input, keeping only the path', () => {
    expect(toPathname('//evil.com/members/profile?token=x')).toBe(
      '/members/profile',
    )
  })

  it('rejects non-root-relative and non-string inputs', () => {
    expect(toPathname('https://example.com/x?token=y')).toBeNull()
    expect(toPathname('members/directory')).toBeNull()
    expect(toPathname(12345)).toBeNull()
    expect(toPathname(undefined)).toBeNull()
  })
})

/** trackEvent is fire-and-forget; poll the events table for the row. */
async function waitForRow(path: string): Promise<{
  email: string | null
  metadata: Record<string, unknown>
} | null> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await pool.query<{
      email: string | null
      metadata: Record<string, unknown>
    }>(
      `SELECT email, metadata FROM cpo_connect.events
       WHERE event = 'page_view' AND metadata->>'path' = $1
       ORDER BY created_at DESC LIMIT 1`,
      [path],
    )
    if (result.rows.length > 0) return result.rows[0]
    await new Promise((r) => setTimeout(r, 25))
  }
  return null
}

dbDescribe('pageViewHandler (real DB)', () => {
  const paths: string[] = []

  afterAll(async () => {
    if (paths.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.events
         WHERE event = 'page_view' AND metadata->>'path' = ANY($1)`,
        [paths],
      )
    }
  })

  it('records a page_view row with the session email and path', async () => {
    const path = `/members/test-${randomUUID()}`
    paths.push(path)
    const email = `weta-pv-${randomUUID()}@test.local`

    const req = makeReq({
      body: { path, ref: '/members/whats-talked' },
      user: { id: 's', email, name: 'PV User' },
    })
    const res = makeRes()
    pageViewHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.end).toHaveBeenCalled()

    const row = await waitForRow(path)
    expect(row).not.toBeNull()
    expect(row?.email).toBe(email)
    expect(row?.metadata).toMatchObject({ path, ref: '/members/whats-talked' })
  })

  it('persists only the pathname when a query string is sent (token never stored)', async () => {
    const base = `/members/secure-${randomUUID()}`
    paths.push(base)

    const req = makeReq({
      body: { path: `${base}?token=super-secret`, ref: `${base}#frag` },
      user: { id: 's', email: `weta-pv-${randomUUID()}@test.local`, name: 'X' },
    })
    const res = makeRes()
    pageViewHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(204)

    const row = await waitForRow(base)
    expect(row).not.toBeNull()
    expect(row?.metadata.path).toBe(base)
    expect(row?.metadata.ref).toBe(base)
    // Belt-and-suspenders: the secret must not appear anywhere in metadata.
    expect(JSON.stringify(row?.metadata)).not.toContain('super-secret')
  })

  it('records a NULL email for an anonymous visit', async () => {
    const path = `/anon-${randomUUID()}`
    paths.push(path)

    const req = makeReq({ body: { path } }) // no user
    const res = makeRes()
    pageViewHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(204)

    const row = await waitForRow(path)
    expect(row).not.toBeNull()
    expect(row?.email).toBeNull()
  })

  it('answers 204 and records nothing when path is missing or not a string', async () => {
    const req = makeReq({ body: { path: 12345 } })
    const res = makeRes()
    pageViewHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(204)

    // No path → metadata->>'path' is the stringified number only if it were
    // recorded; assert no row exists for it.
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM cpo_connect.events
       WHERE event = 'page_view' AND metadata->>'path' = '12345'
       AND created_at >= NOW() - INTERVAL '1 minute'`,
    )
    expect(result.rows.length).toBe(0)
  })
})
