// Imported first for its side effects — loads .env and normalizes
// DATABASE_URL before pool is constructed via the downstream import.
import './_requireIngestAuth-setup'

import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import pool from '../../server/db'
import { pageViewHandler } from '../../server/routes/events'
import { makeReq, makeRes } from './_express-mocks'

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

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
