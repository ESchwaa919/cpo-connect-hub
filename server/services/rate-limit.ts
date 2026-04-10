// NOTE: In-memory rate limits are lost on server restart. For multi-instance deployments, use Redis or PostgreSQL-backed rate limiting.

interface RateLimitEntry {
  count: number
  resetTime: number
}

/** Result of a rate-limit check. `resetTime` is ms-since-epoch when the
 *  current window ends; callers can compute dynamic `Retry-After` values
 *  by subtracting `Date.now()`. */
export interface CheckResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

interface RateLimiter {
  check(key: string): CheckResult
  reset(key: string): void
}

interface RateLimiterOptions {
  windowMs: number
  max: number
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions): RateLimiter {
  const store = new Map<string, RateLimitEntry>()

  // Periodically clean up expired entries to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetTime) {
        store.delete(key)
      }
    }
  }, 2 * windowMs)

  // Allow the process to exit without waiting for the interval
  cleanupInterval.unref()

  function check(key: string): CheckResult {
    const now = Date.now()
    const entry = store.get(key)

    // If no entry or window has expired, start a fresh window
    if (!entry || now >= entry.resetTime) {
      const resetTime = now + windowMs
      store.set(key, { count: 1, resetTime })
      return { allowed: true, remaining: max - 1, resetTime }
    }

    // Window is still active — check BEFORE incrementing
    if (entry.count >= max) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime }
    }

    entry.count += 1
    return { allowed: true, remaining: max - entry.count, resetTime: entry.resetTime }
  }

  function reset(key: string): void {
    store.delete(key)
  }

  return { check, reset }
}
