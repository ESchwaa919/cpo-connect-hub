import { Router } from 'express'
import { createHash } from 'node:crypto'
import { requireAuth } from '../middleware/auth.ts'
import { getDirectory } from '../services/sheets.ts'
import { createRateLimiter } from '../services/rate-limit.ts'
import { enrichFromLinkedIn } from '../services/enrichment.ts'
import pool from '../db.ts'

function gravatarUrl(email: string, size = 80): string {
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`
}

const router = Router()

// One enrichment attempt per user per 24 hours
const enrichLimiter = createRateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 1 })

// Editable profile fields (whitelist)
const EDITABLE_FIELDS = [
  'name', 'role', 'current_org', 'sector', 'location',
  'focus_areas', 'areas_of_interest', 'linkedin_url', 'bio', 'skills',
] as const

const PROFILE_COLUMNS = `email, name, role, current_org, sector, location,
  focus_areas, areas_of_interest, linkedin_url, bio,
  skills, enrichment_source, profile_enriched`

const PROFILE_SELECT = `SELECT ${PROFILE_COLUMNS} FROM cpo_connect.member_profiles WHERE email = $1`

// ---------------------------------------------------------------------------
// GET /profile — get current user's profile (requires auth)
// ---------------------------------------------------------------------------
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(PROFILE_SELECT, [req.user!.email])

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found', code: 'profile_not_found' })
      return
    }

    res.status(200).json(result.rows[0])
  } catch (err) {
    console.error('GET /profile error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})

// ---------------------------------------------------------------------------
// PUT /profile — update current user's profile (requires auth)
// ---------------------------------------------------------------------------
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const updates: Record<string, string> = {}
    for (const field of EDITABLE_FIELDS) {
      if (field in req.body && typeof req.body[field] === 'string') {
        updates[field] = req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update', code: 'no_fields' })
      return
    }

    const setClauses = Object.keys(updates).map((key, i) => `"${key}" = $${i + 2}`)
    setClauses.push('updated_at = NOW()')
    const values = [req.user!.email, ...Object.values(updates)]

    const result = await pool.query(
      `UPDATE cpo_connect.member_profiles SET ${setClauses.join(', ')} WHERE email = $1 RETURNING ${PROFILE_COLUMNS}`,
      values
    )
    res.status(200).json(result.rows[0])
  } catch (err) {
    console.error('PUT /profile error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})

// ---------------------------------------------------------------------------
// POST /profile/enrich — LinkedIn enrichment (requires auth)
// ---------------------------------------------------------------------------
router.post('/profile/enrich', requireAuth, async (req, res) => {
  try {
    const email = req.user!.email

    // Rate limit: one attempt per user per 24 hours
    const limitCheck = enrichLimiter.check(`enrich:${email}`)
    if (!limitCheck.allowed) {
      res.status(429).json({
        error: 'You can only enrich your profile once per day. Please try again tomorrow.',
        code: 'rate_limited',
      })
      return
    }

    // Get current profile
    const profileResult = await pool.query(
      'SELECT linkedin_url, name FROM cpo_connect.member_profiles WHERE email = $1',
      [email]
    )

    if (profileResult.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found', code: 'profile_not_found' })
      return
    }

    const { linkedin_url, name } = profileResult.rows[0] as { linkedin_url: string; name: string }

    if (!linkedin_url) {
      res.status(400).json({
        error: 'Add your LinkedIn URL to your profile first',
        code: 'no_linkedin_url',
      })
      return
    }

    // Enrich via LinkedIn + Claude
    const enrichment = await enrichFromLinkedIn(linkedin_url, name)

    // Update profile with enrichment results
    const result = await pool.query(
      `UPDATE cpo_connect.member_profiles
       SET bio = $2, skills = $3, profile_enriched = TRUE,
           enrichment_source = 'linkedin', updated_at = NOW()
       WHERE email = $1
       RETURNING ${PROFILE_COLUMNS}`,
      [email, enrichment.bio, enrichment.skills]
    )
    res.status(200).json(result.rows[0])
  } catch (err) {
    console.error('POST /profile/enrich error:', (err as Error).message)
    res.status(500).json({ error: 'Enrichment failed. Please try again later.', code: 'enrichment_error' })
  }
})

// ---------------------------------------------------------------------------
// GET /directory — list members (requires auth)
// ---------------------------------------------------------------------------
router.get('/directory', requireAuth, async (_req, res) => {
  try {
    const members = await getDirectory()
    const enriched = members.map((m) => {
      const email = m['Email']?.trim()
      if (email) {
        return { ...m, gravatarUrl: gravatarUrl(email) }
      }
      return m
    })
    res.status(200).json({ members: enriched })
  } catch (err) {
    console.error('GET /directory error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})

export default router
