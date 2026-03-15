import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRateLimiter } from '../../server/services/rate-limit'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 })

    const result = limiter.check('user-1')
    expect(result.allowed).toBe(true)
  })

  it('blocks requests over the limit', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 })

    limiter.check('user-2')
    limiter.check('user-2')
    const result = limiter.check('user-2')

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('tracks keys independently', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })

    const first = limiter.check('key-a')
    const second = limiter.check('key-b')

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)

    // Now both are at the limit
    expect(limiter.check('key-a').allowed).toBe(false)
    expect(limiter.check('key-b').allowed).toBe(false)
  })

  it('resets after the window expires', () => {
    vi.useFakeTimers()

    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })

    limiter.check('user-3') // uses up the single allowed request
    expect(limiter.check('user-3').allowed).toBe(false)

    // Advance past the window
    vi.advanceTimersByTime(60_001)

    const result = limiter.check('user-3')
    expect(result.allowed).toBe(true)

    vi.useRealTimers()
  })

  it('returns correct remaining count', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 })

    const first = limiter.check('user-4')
    expect(first.remaining).toBe(4)

    const second = limiter.check('user-4')
    expect(second.remaining).toBe(3)

    const third = limiter.check('user-4')
    expect(third.remaining).toBe(2)
  })
})
