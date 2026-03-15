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

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookie = req.cookies?.cpo_session as string | undefined

  if (!cookie) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }

  // Cookie format: s:<signed-value> — strip the s: prefix before unsigning
  const raw = cookie.startsWith('s:') ? cookie.slice(2) : cookie
  const secret = process.env.SESSION_SECRET

  if (!secret) {
    console.error('requireAuth: SESSION_SECRET is not set')
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }

  const sessionId = unsign(raw, secret)

  if (sessionId === false) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name FROM cpo_connect.sessions WHERE id = $1 AND expires_at > NOW()',
      [sessionId]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
      return
    }

    const session = result.rows[0] as { id: string; email: string; name: string }
    req.user = { id: session.id, email: session.email, name: session.name }
    next()
  } catch (err) {
    console.error('requireAuth: DB error —', (err as Error).message)
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
  }
}
