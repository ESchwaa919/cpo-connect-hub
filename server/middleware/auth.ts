import type { Request, Response, NextFunction } from 'express'
import { unsign } from 'cookie-signature'
import pool from '../db.ts'

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        name: string
      }
    }
  }
}

/** Resolves the authenticated user from the `cpo_session` cookie, or `null`
 *  when the cookie is missing / invalid / expired. Never writes to the
 *  response — callers decide whether absence is fatal (requireAuth) or
 *  acceptable (optionalAuth). */
async function resolveUserFromCookie(
  req: Request,
): Promise<{ id: string; email: string; name: string } | null> {
  const cookie = req.cookies?.cpo_session as string | undefined
  if (!cookie) return null

  // Cookie format: s:<signed-value> — strip the s: prefix before unsigning
  const raw = cookie.startsWith('s:') ? cookie.slice(2) : cookie
  const secret = process.env.SESSION_SECRET

  if (!secret) {
    console.error('resolveUserFromCookie: SESSION_SECRET is not set')
    return null
  }

  const sessionId = unsign(raw, secret)
  if (sessionId === false) return null

  try {
    const result = await pool.query(
      'SELECT id, email, name FROM cpo_connect.sessions WHERE id = $1 AND expires_at > NOW()',
      [sessionId],
    )
    if (result.rows.length === 0) return null
    return result.rows[0] as { id: string; email: string; name: string }
  } catch (err) {
    console.error('resolveUserFromCookie: DB error —', (err as Error).message)
    return null
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = await resolveUserFromCookie(req)
  if (!user) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }
  req.user = user
  next()
}

/** Like requireAuth, but never rejects: sets `req.user` when a valid session
 *  cookie is present and leaves it undefined otherwise, always calling next().
 *  Used by the page-view tracking endpoint so anonymous visits are still
 *  recorded (with a NULL email). */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await resolveUserFromCookie(req)
  if (user) req.user = user
  next()
}
