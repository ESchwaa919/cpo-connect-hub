import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
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
  })

  it('delegates to requireAdmin when a cookie session is already set', () => {
    const req = {
      user: { id: 's', email: 'erik@theaiexpert.ai', name: 'Erik' },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('rejects when cookie session is for a non-admin user', () => {
    const req = {
      user: { id: 's', email: 'joe@example.com', name: 'Joe' },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('accepts a matching X-Ingest-Key header and sets a synthetic user', () => {
    const req = {
      user: undefined,
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? KEY : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user).toEqual(SCRIPT_USER)
  })

  it('rejects a mismatched X-Ingest-Key header with 401', () => {
    const bogus = 'f'.repeat(KEY.length)
    const req = {
      user: undefined,
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? bogus : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a header of the wrong length (guards timingSafeEqual)', () => {
    const req = {
      user: undefined,
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? 'short' : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects when INGEST_API_KEY is unset and no cookie', () => {
    delete process.env.INGEST_API_KEY
    const req = {
      user: undefined,
      header: () => 'whatever',
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects with 401 when neither cookie nor header is present', () => {
    const req = { user: undefined, header: () => undefined } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
