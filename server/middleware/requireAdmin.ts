import type { Request, Response, NextFunction } from 'express'

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
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

  const admins = getAdminEmails()
  if (!admins.includes(req.user.email.toLowerCase())) {
    res.status(403).json({ error: 'Admin access required', code: 'not_admin' })
    return
  }

  next()
}
