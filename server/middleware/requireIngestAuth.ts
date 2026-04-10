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
 *   - Cookie path: invokes the existing `requireAuth` (which loads the
 *     cookie session and populates `req.user`), then `requireAdmin` to
 *     enforce `ADMIN_EMAILS`.
 *
 *  The middleware must not depend on any upstream auth — it is mounted
 *  directly on the route so the header path can work without a cookie. */
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

  // Defensive short-circuit: if upstream middleware happens to have set
  // req.user (e.g. mounted under another requireAuth chain), skip the
  // cookie load and go straight to the admin check.
  if (req.user) {
    requireAdmin(req, res, next)
    return
  }

  // Cookie path — invoke requireAuth ourselves, then requireAdmin on success.
  await requireAuth(req, res, () => {
    if (res.headersSent) return
    requireAdmin(req, res, next)
  })
}
