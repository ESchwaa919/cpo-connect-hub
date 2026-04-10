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

describe('chatAskRateLimit', () => {
  beforeEach(() => {
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

  it('tracks quotas independently per member', () => {
    // Burn alice's minute quota entirely
    for (let i = 0; i < 10; i++) {
      run(makeReq('alice@example.com'))
    }

    // Bob is unaffected
    const { res, next } = run(makeReq('bob@example.com'))
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()

    // Alice is still rejected
    const alice = run(makeReq('alice@example.com'))
    expect(alice.res.status).toHaveBeenCalledWith(429)
  })

  it('treats member emails case-insensitively', () => {
    for (let i = 0; i < 10; i++) {
      run(makeReq('alice@example.com'))
    }

    // Same member, uppercase — should still be rejected
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
    vi.useFakeTimers()

    // Burn 10 requests per minute for 10 minutes = 100 total.
    // vi.advanceTimersByTime past the minute window between bursts so
    // the minute-tier counter resets but the hour-tier counter
    // accumulates.
    for (let minute = 0; minute < 10; minute++) {
      for (let i = 0; i < 10; i++) {
        run(makeReq('alice@example.com'))
      }
      vi.advanceTimersByTime(61 * 1000)
    }

    // The 101st request inside the same hour should be rejected by the
    // hour limiter even though the minute window is fresh.
    const { res, next } = run(makeReq('alice@example.com'))

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith({
      error: 'rate_limited',
      retryAfterSec: 60 * 60,
    })
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', String(60 * 60))
    expect(next).not.toHaveBeenCalled()
  })
})
