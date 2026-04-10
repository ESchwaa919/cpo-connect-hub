import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// Hoisted mocks for the dependencies that requireAuth pulls in — vitest
// hoists vi.mock factories to the top of the file, so the mock variables
// they capture must be hoisted too.
const { poolQueryMock, unsignMock } = vi.hoisted(() => ({
  poolQueryMock: vi.fn(),
  unsignMock: vi.fn(),
}))

vi.mock('../../server/db', () => ({
  default: { query: poolQueryMock },
}))

vi.mock('cookie-signature', () => ({
  unsign: unsignMock,
}))

import {
  requireIngestAuth,
  SCRIPT_USER,
} from '../../server/middleware/requireIngestAuth'

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

const KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('requireIngestAuth', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'erik@theaiexpert.ai'
    process.env.INGEST_API_KEY = KEY
    process.env.SESSION_SECRET = 'test-secret'
    poolQueryMock.mockReset()
    unsignMock.mockReset()
  })

  // -------------------------------------------------------------------------
  // Header path (script)
  // -------------------------------------------------------------------------

  it('accepts a matching X-Ingest-Key header and sets a synthetic user', async () => {
    const req = {
      user: undefined,
      cookies: {},
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? KEY : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user).toEqual(SCRIPT_USER)
  })

  it('rejects a mismatched X-Ingest-Key header with 401', async () => {
    const bogus = 'f'.repeat(KEY.length)
    const req = {
      user: undefined,
      cookies: {},
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? bogus : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a header of a different length with 401', async () => {
    // With SHA-256 hashing, both inputs get normalized to 32-byte digests
    // before comparison — so the early-return length pre-check is gone. A
    // short guess must still fail the same way.
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

  // -------------------------------------------------------------------------
  // Cookie path (fresh session load via requireAuth)
  // -------------------------------------------------------------------------

  it('loads a fresh admin session from the cookie and calls next', async () => {
    unsignMock.mockReturnValue('session-id-1')
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ id: 'session-id-1', email: 'erik@theaiexpert.ai', name: 'Erik' }],
    })

    const req = {
      user: undefined,
      cookies: { cpo_session: 's:signed-value' },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user).toEqual({
      id: 'session-id-1',
      email: 'erik@theaiexpert.ai',
      name: 'Erik',
    })
  })

  it('returns 403 when the cookie session is a valid non-admin user', async () => {
    unsignMock.mockReturnValue('session-id-2')
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ id: 'session-id-2', email: 'joe@example.com', name: 'Joe' }],
    })

    const req = {
      user: undefined,
      cookies: { cpo_session: 's:signed-value' },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
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

  it('returns 401 when the cookie session does not exist in the DB', async () => {
    unsignMock.mockReturnValue('session-id-bogus')
    poolQueryMock.mockResolvedValueOnce({ rows: [] })

    const req = {
      user: undefined,
      cookies: { cpo_session: 's:signed-value' },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
