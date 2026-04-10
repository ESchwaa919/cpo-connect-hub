import type { Request, Response, NextFunction } from 'express'
import { createHash, timingSafeEqual } from 'node:crypto'
import { requireAuth } from './auth.ts'
import { requireAdmin } from './requireAdmin.ts'

/** Synthetic identity for headless ingestion-script runs. Stored in
 *  chat_ingestion_runs.triggered_by_email so run history is attributable. */
export const SCRIPT_USER = {
  id: 'script',
  email: 'script:ingest',
  name: 'Ingestion Script',
} as const

/** Constant-time comparison on fixed-length SHA-256 digests of both inputs.
 *  Hashing first ensures comparison cost does not correlate with the length
 *  of the original values — a length-leak attacker cannot distinguish
 *  short guesses from long ones by measuring response time. */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

/** Dual auth for POST /api/admin/chat/ingest:
 *   - Header path: `X-Ingest-Key` matches `INGEST_API_KEY`. Sets `req.user`
 *     to a synthetic SCRIPT_USER for run attribution.
 *   - Cookie path: invokes the existing `requireAuth` to load the session,
 *     then `requireAdmin` to enforce `ADMIN_EMAILS`.
 *
 *  Mounted directly on the route — no upstream auth is assumed, and none
 *  must be added (the header path must work without a cookie). Because
 *  this middleware is the single entry point to the ingest route,
 *  `req.user` is never pre-populated; we don't carry a defensive
 *  short-circuit for that case (would be dead code and a theoretical
 *  privilege-escalation surface if `req.user` ever became writable from
 *  request input). */
export async function requireIngestAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('x-ingest-key')

  if (header) {
    const expected = process.env.INGEST_API_KEY ?? ''
    if (!expected || !safeEqual(header, expected)) {
      res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
      return
    }
    req.user = { ...SCRIPT_USER }
    next()
    return
  }

  // Cookie path — wrap requireAuth + requireAdmin in an explicit Promise so
  // the outer await reflects the full chain's completion, not just
  // requireAuth's internal Promise. Defensive against future changes to
  // requireAuth that might defer its continuation via setImmediate or
  // microtasks. `resolve()` is idempotent; the `.finally` handles the case
  // where requireAuth responds with 401 itself and never calls the
  // continuation.
  await new Promise<void>((resolve) => {
    void requireAuth(req, res, () => {
      if (res.headersSent) {
        resolve()
        return
      }
      requireAdmin(req, res, (err?: unknown) => {
        if (err) next(err as Error)
        else next()
        resolve()
      })
    }).finally(resolve)
  })
}
