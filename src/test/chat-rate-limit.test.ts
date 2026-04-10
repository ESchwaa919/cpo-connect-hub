import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import {
  chatAskRateLimit,
  resetChatAskRateLimits,
} from '../../server/services/chat-rate-limit'

function makeReq(email: string | undefined): Request {
  if (email === undefined) {
    return {} as Request
  }
  return {
    user: { id: 'session-1', email, name: 'Test' },
  } as unknown as Request
}

function makeRes() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
}

function run(req: Request): { res: Response; next: NextFunction } {
  const res = makeRes()
  const next = vi.fn() as unknown as NextFunction
  chatAskRateLimit(req, res, next)
  return { res, next }
}

function retryAfterSecFromJson(res: Response): number {
  const jsonMock = res.json as unknown as { mock: { calls: unknown[][] } }
  const body = jsonMock.mock.calls[0][0] as { retryAfterSec: number }
  return body.retryAfterSec
}

describe('chatAskRateLimit', () => {
  beforeEach(() => {
    // Pin system time so retryAfterSec math is deterministic. Without this
    // the assertions on exact second values are racy.
    vi.useFakeTimers()
    vi.setSystemTime(0)
    resetChatAskRateLimits('alice@example.com')
    resetChatAskRateLimits('bob@example.com')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows 10 requests per minute', () => {
    for (let i = 0; i < 10; i++) {
      const { res, next } = run(makeReq('alice@example.com'))
      expect(next).toHaveBeenCalledTimes(1)
      expect(res.status).not.toHaveBeenCalled()
    }
  })

  it('returns 429 with retryAfterSec=60 on the 11th request in a minute', () => {
    for (let i = 0; i < 10; i++) {
      run(makeReq('alice@example.com'))
    }

    const { res, next } = run(makeReq('alice@example.com'))

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith({ error: 'rate_limited', retryAfterSec: 60 })
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60')
    expect(next).not.toHaveBeenCalled()
  })

  it('returns a dynamic retryAfterSec reflecting remaining window time', () => {
    // Burn through the minute quota at t=0
    for (let i = 0; i < 10; i++) {
      run(makeReq('alice@example.com'))
    }

    // Trip the limit at t=0 — full 60s window remaining
    const first = run(makeReq('alice@example.com'))
    expect(retryAfterSecFromJson(first.res)).toBe(60)

    // Advance 45 seconds within the same minute window
    vi.advanceTimersByTime(45_000)

    // Trip again — now advertises ~15s remaining instead of a fixed 60
    const second = run(makeReq('alice@example.com'))
    expect(retryAfterSecFromJson(second.res)).toBe(15)
  })

  it('tracks quotas independently per member', () => {
    for (let i = 0; i < 10; i++) {
      run(makeReq('alice@example.com'))
    }

    const { res, next } = run(makeReq('bob@example.com'))
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()

    const alice = run(makeReq('alice@example.com'))
    expect(alice.res.status).toHaveBeenCalledWith(429)
  })

  it('treats member emails case-insensitively', () => {
    for (let i = 0; i < 10; i++) {
      run(makeReq('alice@example.com'))
    }

    const { res, next } = run(makeReq('ALICE@Example.com'))
    expect(res.status).toHaveBeenCalledWith(429)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when req.user is missing', () => {
    const { res, next } = run(makeReq(undefined))
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('enforces the 100/hour ceiling across multiple minute windows', () => {
    // Burn 10 requests per minute for 10 minutes = 100 total.
    // Advance past the minute window between bursts so the minute-tier
    // counter resets but the hour-tier counter accumulates.
    for (let minute = 0; minute < 10; minute++) {
      for (let i = 0; i < 10; i++) {
        run(makeReq('alice@example.com'))
      }
      vi.advanceTimersByTime(61 * 1000)
    }

    // t=610s. Hour window started at t=0, so resetTime=3600s.
    // Remaining = 3600-610 = 2990s.
    const { res, next } = run(makeReq('alice@example.com'))

    expect(res.status).toHaveBeenCalledWith(429)
    expect(retryAfterSecFromJson(res)).toBe(2990)
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '2990')
    expect(next).not.toHaveBeenCalled()
  })
})
