import type { Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { requireAdmin } from './requireAdmin.ts'

/** Synthetic identity for headless ingestion-script runs. Stored in
 *  chat_ingestion_runs.triggered_by_email so run history is attributable. */
export const SCRIPT_USER = {
  id: 'script',
  email: 'script:ingest',
  name: 'Ingestion Script',
} as const

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function requireIngestAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user) {
    return requireAdmin(req, res, next)
  }

  const provided = req.header('x-ingest-key') ?? ''
  const expected = process.env.INGEST_API_KEY ?? ''

  if (!provided || !expected || !safeEqual(provided, expected)) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }

  req.user = { ...SCRIPT_USER }
  next()
}
