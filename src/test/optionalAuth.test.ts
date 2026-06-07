// Imported first for its side effects — loads .env and normalizes
// DATABASE_URL before pool is constructed via the downstream import.
import './_requireIngestAuth-setup'

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { sign as signCookie } from 'cookie-signature'
import pool from '../../server/db'
import { optionalAuth } from '../../server/middleware/auth'
import { makeRes } from './_express-mocks'

const TEST_SESSION_SECRET = 'weta-test-session-secret-do-not-use-in-prod'

// -----------------------------------------------------------------------------
// No-DB paths — optionalAuth must never reject and must leave req.user unset
// when the cookie is absent or unverifiable.
// -----------------------------------------------------------------------------

describe('optionalAuth — anonymous paths (no DB)', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET
  })

  it('calls next() with no req.user when no cookie is present', async () => {
    const req = { user: undefined, cookies: {} } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await optionalAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user).toBeUndefined()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('calls next() with no req.user when the signature is invalid', async () => {
    const signed = 's:' + signCookie(randomUUID(), 'wrong-secret')
    const req = {
      user: undefined,
      cookies: { cpo_session: signed },
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await optionalAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user).toBeUndefined()
    expect(res.status).not.toHaveBeenCalled()
  })
})

// -----------------------------------------------------------------------------
// Cookie path — REAL database. Skips cleanly without DATABASE_URL.
// -----------------------------------------------------------------------------

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

dbDescribe('optionalAuth — valid session (real DB)', () => {
  const email = `weta-optauth-${randomUUID()}@test.local`
  let sessionId = ''

  beforeAll(async () => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET
    const result = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.sessions (email, name, expires_at)
       VALUES ($1, 'WETA OptAuth User', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [email],
    )
    sessionId = result.rows[0].id
  })

  afterAll(async () => {
    await pool.query(`DELETE FROM cpo_connect.sessions WHERE id = $1::uuid`, [
      sessionId,
    ])
  })

  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET
  })

  it('sets req.user from a valid signed cookie', async () => {
    const signed = 's:' + signCookie(sessionId, TEST_SESSION_SECRET)
    const req = {
      user: undefined,
      cookies: { cpo_session: signed },
    } as unknown as Request
    const res = makeRes() as Response
    const next = vi.fn() as unknown as NextFunction

    await optionalAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user?.email).toBe(email)
  })
})
