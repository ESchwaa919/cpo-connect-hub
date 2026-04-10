import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requireAdmin } from '../../server/middleware/requireAdmin'

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

describe('requireAdmin', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@example.com,erik@theaiexpert.ai'
  })

  it('calls next() when the user email is in ADMIN_EMAILS', () => {
    const req = {
      user: { id: 's', email: 'erik@theaiexpert.ai', name: 'Erik' },
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when the user is not in ADMIN_EMAILS', () => {
    const req = { user: { id: 's', email: 'joe@example.com', name: 'Joe' } } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when req.user is missing', () => {
    const req = {} as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('matches ADMIN_EMAILS case-insensitively with whitespace trimmed', () => {
    process.env.ADMIN_EMAILS = ' Erik@TheAiExpert.ai , admin@example.com '
    const req = {
      user: { id: 's', email: 'erik@theaiexpert.ai', name: 'E' },
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS
    const req = {
      user: { id: 's', email: 'erik@theaiexpert.ai', name: 'Erik' },
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
