import { Router } from 'express'
import crypto from 'crypto'
import { sign } from 'cookie-signature'
import pool from '../db.ts'
import { lookupMember } from '../services/sheets.ts'
import { sendMagicLink } from '../services/email.ts'
import { createRateLimiter } from '../services/rate-limit.ts'
import { requireAuth } from '../middleware/auth.ts'
import type { MemberRecord } from '../services/sheets.ts'

const router = Router()

// Rate limiters
const ipLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 }) // 10 per minute
const emailLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 }) // 3 per hour

// Membership cache for /me endpoint (5 min TTL, keyed by email)
const membershipCache = new Map<string, { data: MemberRecord; expiresAt: number }>()

function getCachedMembership(email: string): MemberRecord | null {
  const entry = membershipCache.get(email)
  if (entry && Date.now() < entry.expiresAt) return entry.data
  membershipCache.delete(email)
  return null
}

function setCachedMembership(email: string, data: MemberRecord): void {
  membershipCache.set(email, { data, expiresAt: Date.now() + 5 * 60 * 1000 })
}

function getClientIp(req: Express.Request & { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]!.trim()
  }
  return req.ip ?? '0.0.0.0'
}

// ---------------------------------------------------------------------------
// POST /request — send magic link
// ---------------------------------------------------------------------------
router.post('/request', async (req, res) => {
  try {
    const clientIp = getClientIp(req)
    const ipCheck = ipLimiter.check(`ip:${clientIp}`)
    if (!ipCheck.allowed) {
      // Still return 200 to prevent enumeration
      res.status(200).json({ code: 'magic_link_sent', memberStatus: 'not_found' })
      return
    }

    const email = (req.body?.email as string ?? '').trim().toLowerCase()
    if (!email) {
      res.status(200).json({ code: 'magic_link_sent', memberStatus: 'not_found' })
      return
    }

    const emailCheck = emailLimiter.check(`email:${email}`)
    if (!emailCheck.allowed) {
      res.status(200).json({ code: 'magic_link_sent', memberStatus: 'not_found' })
      return
    }

    const member = await lookupMember(email)

    if (!member || member.status.toLowerCase() !== 'joined') {
      res.status(200).json({ code: 'magic_link_sent', memberStatus: 'not_found' })
      return
    }

    // Generate token and store in DB
    const token = crypto.randomBytes(32).toString('hex')
    const insertResult = await pool.query(
      'INSERT INTO cpo_connect.magic_link_tokens (email, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\') RETURNING id, expires_at',
      [email, token]
    )
    const inserted = insertResult.rows[0] as { id: string; expires_at: string }
    console.log('[request] Token inserted — id:', inserted.id, 'expires_at:', inserted.expires_at, 'token prefix:', token.slice(0, 8) + '...')

    // Verify token can be read back immediately
    const verifyInsert = await pool.query(
      'SELECT id FROM cpo_connect.magic_link_tokens WHERE token = $1',
      [token]
    )
    console.log('[request] Verify read-back — rows:', verifyInsert.rows.length)

    // Send email
    console.log('[request] Sending magic link email to:', email)
    await sendMagicLink({ email, token, name: member.name })
    console.log('[request] Email sent successfully')

    // Best-effort cleanup of expired tokens and sessions (fire-and-forget)
    pool.query('DELETE FROM cpo_connect.magic_link_tokens WHERE expires_at < NOW()').catch(() => {})
    pool.query('DELETE FROM cpo_connect.sessions WHERE expires_at < NOW()').catch(() => {})

    res.status(200).json({ code: 'magic_link_sent', memberStatus: 'sent' })
  } catch (err) {
    console.error('POST /request error:', (err as Error).message)
    // Always return 200 to prevent email enumeration
    res.status(200).json({ code: 'magic_link_sent', memberStatus: 'not_found' })
  }
})

// ---------------------------------------------------------------------------
// GET /verify — verify magic link token
// ---------------------------------------------------------------------------
router.get('/verify', async (req, res) => {
  const token = req.query.token as string | undefined
  console.log('[verify] Entry — token present:', !!token, 'url:', req.originalUrl)

  if (!token) {
    console.log('[verify] No token in query params, redirecting to /?verify=expired')
    res.redirect(302, '/?verify=expired')
    return
  }

  try {
    // Look up valid token — allow reuse within expiry window to handle
    // email link scanners (Gmail Safe Browsing) that pre-fetch links
    const tokenResult = await pool.query(
      'SELECT id, email FROM cpo_connect.magic_link_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    )

    console.log('[verify] Token lookup — rows found:', tokenResult.rows.length)

    if (tokenResult.rows.length === 0) {
      console.log('[verify] Token not found or expired, redirecting to /?verify=expired')
      res.redirect(302, '/?verify=expired')
      return
    }

    const tokenRow = tokenResult.rows[0] as { id: string; email: string }
    console.log('[verify] Token valid for email:', tokenRow.email)

    // Mark token as used (idempotent — may already be used by a link scanner)
    await pool.query('UPDATE cpo_connect.magic_link_tokens SET used = TRUE WHERE id = $1', [tokenRow.id])

    // Look up member name
    const member = await lookupMember(tokenRow.email)
    const memberName = member?.name ?? ''

    // Create session (7-day expiry)
    const sessionResult = await pool.query(
      'INSERT INTO cpo_connect.sessions (email, name, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\') RETURNING id',
      [tokenRow.email, memberName]
    )
    const sessionId = (sessionResult.rows[0] as { id: string }).id
    console.log('[verify] Session created — id:', sessionId, 'name:', memberName)

    // Sync member profile on first login
    try {
      const profileExists = await pool.query(
        'SELECT email FROM cpo_connect.member_profiles WHERE email = $1',
        [tokenRow.email]
      )

      if (profileExists.rows.length === 0 && member) {
        await pool.query(
          `INSERT INTO cpo_connect.member_profiles
           (email, name, role, current_org, sector, location, focus_areas, areas_of_interest, linkedin_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tokenRow.email,
            member.name,
            member.jobRole,
            member.currentOrg,
            member.industry,
            member.location,
            member.focusAreas,
            member.areasOfInterest,
            member.linkedinUrl,
          ]
        )
        console.log('[verify] Profile created for:', tokenRow.email)
      }
    } catch (profileErr) {
      // Don't fail the login if profile sync fails
      console.error('[verify] Profile sync error:', (profileErr as Error).message)
    }

    // Sign the session ID and set cookie
    const secret = process.env.SESSION_SECRET
    if (!secret) {
      console.error('[verify] SESSION_SECRET is not set!')
      res.redirect(302, '/?verify=expired')
      return
    }

    const signedValue = 's:' + sign(sessionId, secret)
    const isProduction = process.env.NODE_ENV === 'production'
    console.log('[verify] Setting cookie — secure:', isProduction, 'sameSite: lax, path: /')

    res.cookie('cpo_session', signedValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: '/',
    })

    console.log('[verify] Redirecting to /members')
    res.redirect(302, '/members')
  } catch (err) {
    console.error('[verify] Error:', (err as Error).message)
    res.redirect(302, '/?verify=expired')
  }
})

// ---------------------------------------------------------------------------
// GET /me — get current user info (requires auth)
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const email = req.user!.email

    // Check membership cache first
    let member = getCachedMembership(email)
    if (!member) {
      member = await lookupMember(email)
      if (member) {
        setCachedMembership(email, member)
      }
    }

    if (!member || member.status.toLowerCase() !== 'joined') {
      // Membership revoked — delete session and return 403
      await pool.query('DELETE FROM cpo_connect.sessions WHERE id = $1', [req.user!.id])
      res.clearCookie('cpo_session', { path: '/' })
      res.status(403).json({ code: 'membership_revoked' })
      return
    }

    res.status(200).json({
      name: member.name,
      email: member.email,
      jobRole: member.jobRole,
    })
  } catch (err) {
    console.error('GET /me error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})

// ---------------------------------------------------------------------------
// POST /logout — log out (requires auth)
// ---------------------------------------------------------------------------
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cpo_connect.sessions WHERE id = $1', [req.user!.id])
    res.clearCookie('cpo_session', { path: '/' })
    res.status(200).json({ code: 'logged_out' })
  } catch (err) {
    console.error('POST /logout error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})

export default router
