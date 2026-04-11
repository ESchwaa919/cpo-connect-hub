import type { Request, Response, NextFunction } from 'express'

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}

/** True iff the given email is in the ADMIN_EMAILS env var (comma-
 *  separated, case-insensitive, whitespace-trimmed on both sides).
 *  Shared by the `requireAdmin` middleware and the /api/auth/me handler
 *  so the frontend and backend agree on who is an admin. */
export function isAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return getAdminEmails().includes(normalized)
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }

  if (!isAdminEmail(req.user.email)) {
    res.status(403).json({ error: 'Admin access required', code: 'not_admin' })
    return
  }

  next()
}
