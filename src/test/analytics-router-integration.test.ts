// Router-level integration test for the admin analytics endpoint. Spins up
// the full Express app via `createApp()` and hits it over HTTP, exercising
// the ACTUAL middleware chain (requireAuth + requireAdmin) rather than
// calling the handler directly — so a regression like "someone dropped
// requireAdmin on /overview" is caught here.
//
// Uses the real DB (per the no-DB-mocks constraint). Skips without
// DATABASE_URL.
import './_requireIngestAuth-setup'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { sign as signCookie } from 'cookie-signature'
import pool from '../../server/db'
import { createApp } from '../../server/app'

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

const TEST_SESSION_SECRET = 'weta-analytics-router-secret'

dbDescribe('admin analytics router integration (live Express app)', () => {
  let server: Server
  let baseUrl: string
  const memberEmail = `weta-an-member-${randomUUID()}@test.local`
  const adminEmail = `weta-an-admin-${randomUUID()}@test.local`
  const insertedSessionIds: string[] = []
  let memberCookie = ''
  let adminCookie = ''

  beforeAll(async () => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET
    process.env.ADMIN_EMAILS = adminEmail

    const memberSession = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.sessions (email, name, expires_at)
       VALUES ($1, 'Analytics Member', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [memberEmail],
    )
    insertedSessionIds.push(memberSession.rows[0].id)
    memberCookie =
      'cpo_session=s:' + signCookie(memberSession.rows[0].id, TEST_SESSION_SECRET)

    const adminSession = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.sessions (email, name, expires_at)
       VALUES ($1, 'Analytics Admin', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [adminEmail],
    )
    insertedSessionIds.push(adminSession.rows[0].id)
    adminCookie =
      'cpo_session=s:' + signCookie(adminSession.rows[0].id, TEST_SESSION_SECRET)

    const app = createApp({ serveStatic: false })
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s))
    })
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
    if (insertedSessionIds.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.sessions WHERE id = ANY($1::uuid[])`,
        [insertedSessionIds],
      )
    }
  })

  it('returns 401 with no session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/admin/analytics/overview`)
    expect(res.status).toBe(401)
  })

  it('returns 403 for an authenticated non-admin', async () => {
    const res = await fetch(`${baseUrl}/api/admin/analytics/overview`, {
      headers: { Cookie: memberCookie },
    })
    expect(res.status).toBe(403)
  })

  it('returns 200 with the overview shape for an admin', async () => {
    const res = await fetch(`${baseUrl}/api/admin/analytics/overview`, {
      headers: { Cookie: adminCookie },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      windowDays: number
      visits: { total: number; perDay: unknown[] }
      users: { unique: number; repeat: number }
      engagement: { topPaths: unknown[]; perUser: unknown[] }
      journeys: unknown[]
    }
    expect(body.windowDays).toBe(30)
    expect(typeof body.visits.total).toBe('number')
    expect(Array.isArray(body.visits.perDay)).toBe(true)
    expect(typeof body.users.unique).toBe('number')
    expect(typeof body.users.repeat).toBe('number')
    expect(Array.isArray(body.engagement.topPaths)).toBe(true)
    expect(Array.isArray(body.engagement.perUser)).toBe(true)
    expect(Array.isArray(body.journeys)).toBe(true)
  })
})
