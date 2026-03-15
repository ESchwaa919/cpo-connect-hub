import { Router } from 'express'
import { requireAuth } from '../middleware/auth.ts'
import { getDirectory } from '../services/sheets.ts'

const router = Router()

// ---------------------------------------------------------------------------
// GET /directory — list members (requires auth)
// ---------------------------------------------------------------------------
router.get('/directory', requireAuth, async (_req, res) => {
  try {
    const members = await getDirectory()
    res.status(200).json({ members })
  } catch (err) {
    console.error('GET /directory error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})

export default router
