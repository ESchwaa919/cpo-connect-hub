import { Router } from 'express'
import { createHash } from 'node:crypto'
import { requireAuth } from '../middleware/auth.ts'
import { getDirectory } from '../services/sheets.ts'
import pool from '../db.ts'

function gravatarUrl(email: string, size = 80): string {
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`
}

const router = Router()

// Editable profile fields (whitelist)
const EDITABLE_FIELDS = [
  'name', 'role', 'current_org', 'sector', 'location',
  'focus_areas', 'areas_of_interest', 'linkedin_url', 'bio', 'skills',
  'show_email', 'show_phone',
] as const

const PROFILE_COLUMNS = `email, name, role, current_org, sector, location,
  focus_areas, areas_of_interest, linkedin_url, bio, skills,
  photo_url, show_email, show_phone, updated_at`

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
    const updates: Record<string, string | boolean> = {}
    for (const field of EDITABLE_FIELDS) {
      if (field in req.body) {
        const val = req.body[field]
        if (field === 'show_email' || field === 'show_phone') {
          if (typeof val === 'boolean') updates[field] = val
        } else if (typeof val === 'string') {
          updates[field] = val
        }
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

// DB column → Sheet1 header mapping for directory overlay
const DB_TO_SHEET: [string, string][] = [
  ['bio', 'Bio'],
  ['skills', 'Skills'],
  ['role', 'Job Role'],
  ['current_org', 'Current or most recent employer'],
  ['sector', 'Industry'],
  ['location', 'Location'],
]

// ---------------------------------------------------------------------------
// GET /directory — list members (requires auth)
// ---------------------------------------------------------------------------
router.get('/directory', requireAuth, async (_req, res) => {
  try {
    const members = await getDirectory()

    // Sheet1 uses 'Email' column
    const emails = members
      .map((m) => m['Email']?.trim())
      .filter((e): e is string => !!e)

    // Batch-query ALL profiles (for DB overlay + privacy flags)
    const profileMap = new Map<string, Record<string, unknown>>()
    if (emails.length > 0) {
      const profileResult = await pool.query(
        `SELECT email, bio, skills, role, current_org, sector, location, photo_url, show_email, show_phone
         FROM cpo_connect.member_profiles
         WHERE email = ANY($1)`,
        [emails]
      )
      for (const row of profileResult.rows) {
        profileMap.set((row.email as string).toLowerCase(), row as Record<string, unknown>)
      }
    }

    const enriched = members.map((m) => {
      const email = m['Email']?.trim()
      const result = { ...m }

      if (email) {
        const profile = profileMap.get(email.toLowerCase())
        const showEmail = profile?.show_email === true
        const showPhone = profile?.show_phone === true

        // Gravatar only for members who opted in to showing email
        if (showEmail) {
          result.gravatarUrl = gravatarUrl(email)
        }

        // Overlay DB profile fields on top of sheet data
        if (profile) {
          for (const [dbCol, sheetKey] of DB_TO_SHEET) {
            if (profile[dbCol]) result[sheetKey] = profile[dbCol] as string
          }
          if (profile.photo_url) result.photoUrl = profile.photo_url as string
        }

        // Strip email/phone unless member has opted in
        if (!showEmail) delete result['Email']
        if (!showPhone) delete result['Phone number']
      } else {
        // No email in sheet — strip phone too
        delete result['Phone number']
      }

      return result
    })

    res.status(200).json({ members: enriched })
  } catch (err) {
    console.error('GET /directory error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})

export default router
