import type { Request, Response, NextFunction } from 'express'

/** Hostnames that should redirect to the canonical host. Currently
 *  just the Render-provided onrender.com URL — adding more is a
 *  single-line edit. */
const NON_CANONICAL_HOSTS: ReadonlySet<string> = new Set([
  'cpo-connect-hub.onrender.com',
])

/** The single host members should be on. Cookies set on this host
 *  carry across all member-area requests; cookies set on the
 *  onrender.com host get siloed and the user appears signed out. */
const CANONICAL_HOST = 'cpoconnect.club'

/** Paths that must NOT be redirected even when hit on a non-canonical
 *  host:
 *  - `/api/auth/verify` is the magic-link completion endpoint; it must
 *    run on whichever host the email link was generated for, otherwise
 *    the token lookup fails and the user is bounced back to login.
 *    (Once `MAGIC_LINK_BASE_URL` is updated to cpoconnect.club, all
 *    new emails will point there directly and this exemption becomes
 *    a back-stop for in-flight links.)
 *  - `/health` is polled by Render's load balancer on the
 *    onrender.com hostname; redirecting it would break health checks. */
const REDIRECT_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  '/api/auth/verify',
  '/health',
])

/** Express middleware that 301-redirects requests on a non-canonical
 *  host to the canonical host, preserving path + query string.
 *  Mounted as the first middleware in `server/app.ts` so unrelated
 *  middleware doesn't waste cycles on requests that are about to be
 *  bounced. */
export function canonicalHostRedirect(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (REDIRECT_EXEMPT_PATHS.has(req.path)) {
    next()
    return
  }
  if (!NON_CANONICAL_HOSTS.has(req.hostname)) {
    next()
    return
  }
  res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`)
}
