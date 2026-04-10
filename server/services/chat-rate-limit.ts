import type { Request, Response, NextFunction } from 'express'
import { createRateLimiter } from './rate-limit.ts'

const MINUTE_WINDOW_MS = 60 * 1000
const HOUR_WINDOW_MS = 60 * 60 * 1000
const MINUTE_MAX = 10
const HOUR_MAX = 100

// Module-scoped singletons. createRateLimiter is in-memory (see
// server/services/rate-limit.ts). State is lost on restart, which is
// acceptable for a single-instance deploy — multi-instance would need
// a Redis-backed store.
const minuteLimiter = createRateLimiter({
  windowMs: MINUTE_WINDOW_MS,
  max: MINUTE_MAX,
})
const hourLimiter = createRateLimiter({
  windowMs: HOUR_WINDOW_MS,
  max: HOUR_MAX,
})

/** Per-member rate limit middleware for POST /api/chat/ask.
 *
 *  Two-tier: 10 questions/minute AND 100 questions/hour keyed on a
 *  lowercased `req.user.email`. Mount AFTER `requireAuth` so `req.user`
 *  is populated. Over-limit returns `429 { error: 'rate_limited',
 *  retryAfterSec }` with a `Retry-After` header. Missing `req.user`
 *  returns 401 so misconfigured chains fail loud instead of silently
 *  bucketing everything under a single key. */
export function chatAskRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const email = req.user?.email?.toLowerCase()
  if (!email) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }

  // Check the minute tier first so a rejected-by-minute request doesn't
  // also burn an hour token. If minute passes, then check hour. (The
  // existing server/routes/auth.ts uses the same sequential pattern.)
  const minuteCheck = minuteLimiter.check(`ask:min:${email}`)
  if (!minuteCheck.allowed) {
    res.setHeader('Retry-After', String(60))
    res.status(429).json({ error: 'rate_limited', retryAfterSec: 60 })
    return
  }

  const hourCheck = hourLimiter.check(`ask:hour:${email}`)
  if (!hourCheck.allowed) {
    res.setHeader('Retry-After', String(60 * 60))
    res.status(429).json({ error: 'rate_limited', retryAfterSec: 60 * 60 })
    return
  }

  next()
}

/** Test helper: reset both tiers for a given email. Exported so tests
 *  can run in any order without bleeding quota state between them. */
export function resetChatAskRateLimits(email: string): void {
  const lc = email.toLowerCase()
  minuteLimiter.reset(`ask:min:${lc}`)
  hourLimiter.reset(`ask:hour:${lc}`)
}
