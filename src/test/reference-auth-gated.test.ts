// Integration test for the auth-gated /reference/ static mount.
// Mirrors chat-router-integration.test.ts: spins up the real Express
// app via createApp({ serveStatic: false }) on an ephemeral port,
// mints a real session via signed cookie, and hits the routes over
// HTTP. Validates: 401 without auth, 200 with auth, 404 on unknown
// file, and path-traversal defense.
import './_requireIngestAuth-setup'

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { sign as signCookie } from 'cookie-signature'
import pool from '../../server/db'
import { createApp } from '../../server/app'

const TEST_SESSION_SECRET = 'weta-reference-test-secret'

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

dbDescribe('reference auth-gated static mount', () => {
  let server: Server
  let baseUrl: string
  const memberEmail = `weta-reference-member-${randomUUID()}@test.local`
  const insertedSessionIds: string[] = []
  let memberSessionCookie = ''

  beforeAll(async () => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET

    const memberSession = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.sessions (email, name, expires_at)
       VALUES ($1, 'Reference Test Member', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [memberEmail],
    )
    insertedSessionIds.push(memberSession.rows[0].id)
    memberSessionCookie =
      'cpo_session=s:' +
      signCookie(memberSession.rows[0].id, TEST_SESSION_SECRET)

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

  it('returns 401 for GET /reference/index.html without a session cookie', async () => {
    const res = await fetch(`${baseUrl}/reference/index.html`)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('not_authenticated')
  })

  it('returns 401 for GET /reference/ (directory root) without a session cookie', async () => {
    const res = await fetch(`${baseUrl}/reference/`)
    expect(res.status).toBe(401)
  })

  it('returns 200 with HTML content for GET /reference/index.html with a valid session', async () => {
    const res = await fetch(`${baseUrl}/reference/index.html`, {
      headers: { Cookie: memberSessionCookie },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    const body = await res.text()
    // The index should list the shipped monthly reports by filename.
    expect(body).toMatch(/chat-analysis-mar2026\.html/)
  })

  it('serves a shipped monthly report with a valid session', async () => {
    const res = await fetch(`${baseUrl}/reference/chat-analysis-mar2026.html`, {
      headers: { Cookie: memberSessionCookie },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    const body = await res.text()
    // The actual report starts with a <!doctype html> declaration.
    expect(body.toLowerCase()).toMatch(/<!doctype html/)
  })

  it('returns 404 for a nonexistent file under /reference/ when authenticated', async () => {
    const res = await fetch(
      `${baseUrl}/reference/does-not-exist-${randomUUID()}.html`,
      {
        headers: { Cookie: memberSessionCookie },
      },
    )
    expect(res.status).toBe(404)
  })

  it('rejects path-traversal attempts, even with a valid session', async () => {
    // Attempt to escape the reference dir via URL-encoded `..` segments.
    // Both express.static's internal normalization AND the fact that
    // `fallthrough: false` means anything that doesn't resolve to a
    // real file under `reference/` returns 404, never 200.
    const targets = [
      `${baseUrl}/reference/../server.ts`,
      `${baseUrl}/reference/..%2Fserver.ts`,
      `${baseUrl}/reference/%2e%2e/server.ts`,
    ]
    for (const url of targets) {
      const res = await fetch(url, {
        headers: { Cookie: memberSessionCookie },
      })
      expect(res.status).not.toBe(200)
      // A 200 here would mean the server leaked a source file — fail
      // loudly if that ever happens. Any other status (400/403/404) is
      // an acceptable rejection.
      const body = await res.text().catch(() => '')
      expect(body).not.toMatch(/import\s+express/)
    }
  })
})
