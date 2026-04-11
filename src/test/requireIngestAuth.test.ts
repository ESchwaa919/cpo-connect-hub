// Imported first for its side effects — loads .env and normalizes
// DATABASE_URL before pool is constructed via the downstream import.
import './_requireIngestAuth-setup'

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Request, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { sign as signCookie } from 'cookie-signature'
import pool from '../../server/db'
import {
  requireIngestAuth,
  SCRIPT_USER,
} from '../../server/middleware/requireIngestAuth'
import { makeRes } from './_express-mocks'

const INGEST_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const TEST_SESSION_SECRET = 'weta-test-session-secret-do-not-use-in-prod'

// -----------------------------------------------------------------------------
// Header path — env-var based, no database required
// -----------------------------------------------------------------------------

describe('requireIngestAuth — header path', () => {
  beforeEach(() => {
    process.env.INGEST_API_KEY = INGEST_KEY
    process.env.ADMIN_EMAILS = 'erik@theaiexpert.ai'
  })

  it('accepts a matching X-Ingest-Key and sets the synthetic user', async () => {
    const req = {
      user: undefined,
      cookies: {},
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? INGEST_KEY : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user).toEqual(SCRIPT_USER)
  })

  it('rejects a mismatched X-Ingest-Key header with 401', async () => {
    const req = {
      user: undefined,
      cookies: {},
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key'
          ? 'f'.repeat(INGEST_KEY.length)
          : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a header of a different length with 401', async () => {
    // SHA-256 hashing normalizes both inputs to 32-byte digests before
    // timingSafeEqual, so a short guess must still fail the same way.
    const req = {
      user: undefined,
      cookies: {},
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? 'short' : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects when the header is present but INGEST_API_KEY is unset', async () => {
    delete process.env.INGEST_API_KEY
    const req = {
      user: undefined,
      cookies: {},
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? 'whatever' : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

// -----------------------------------------------------------------------------
// Cookie path — REAL database, per the dispatch's no-mocks hard constraint.
//
// Requires DATABASE_URL to be set. Skips cleanly otherwise. Each test inserts
// unique session rows (UUID-randomized) into cpo_connect.sessions, exercises
// the middleware against them, and cleans up in afterAll. SESSION_SECRET is
// set to a fixed test value so real cookie-signature sign/unsign works.
// -----------------------------------------------------------------------------

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

dbDescribe('requireIngestAuth — cookie path (real DB)', () => {
  const adminEmail = `weta-test-admin-${randomUUID()}@test.local`
  const nonAdminEmail = `weta-test-user-${randomUUID()}@test.local`
  const insertedSessionIds: string[] = []
  let adminSessionId = ''
  let nonAdminSessionId = ''

  beforeAll(async () => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET

    const adminResult = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.sessions (email, name, expires_at)
       VALUES ($1, 'WETA Test Admin', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [adminEmail],
    )
    adminSessionId = adminResult.rows[0].id
    insertedSessionIds.push(adminSessionId)

    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.sessions (email, name, expires_at)
       VALUES ($1, 'WETA Test User', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [nonAdminEmail],
    )
    nonAdminSessionId = userResult.rows[0].id
    insertedSessionIds.push(nonAdminSessionId)
  })

  afterAll(async () => {
    if (insertedSessionIds.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.sessions WHERE id = ANY($1::uuid[])`,
        [insertedSessionIds],
      )
    }
  })

  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET
    process.env.ADMIN_EMAILS = adminEmail
    process.env.INGEST_API_KEY = INGEST_KEY
  })

  it('accepts a signed cookie for a real admin session', async () => {
    const signed = 's:' + signCookie(adminSessionId, TEST_SESSION_SECRET)
    const req = {
      user: undefined,
      cookies: { cpo_session: signed },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user?.email).toBe(adminEmail)
  })

  it('returns 403 for a real non-admin session', async () => {
    const signed = 's:' + signCookie(nonAdminSessionId, TEST_SESSION_SECRET)
    const req = {
      user: undefined,
      cookies: { cpo_session: signed },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when the signed cookie points to a nonexistent session', async () => {
    // Generate a UUID that does not exist in cpo_connect.sessions.
    const phantomId = randomUUID()
    const signed = 's:' + signCookie(phantomId, TEST_SESSION_SECRET)
    const req = {
      user: undefined,
      cookies: { cpo_session: signed },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when no cookie and no header are present', async () => {
    const req = {
      user: undefined,
      cookies: {},
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when the cookie signature is invalid', async () => {
    // Sign with a different secret — requireAuth's unsign() will reject.
    const signed = 's:' + signCookie(adminSessionId, 'wrong-secret')
    const req = {
      user: undefined,
      cookies: { cpo_session: signed },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
