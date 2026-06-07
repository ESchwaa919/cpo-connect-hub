import { Router, type Request, type Response } from 'express'
import { optionalAuth } from '../middleware/auth.ts'
import { trackEvent, AnalyticsEvent } from '../services/analytics.ts'

const router = Router()

// Cap stored path length so a hostile or buggy client can't bloat the
// events table. Real in-app paths are well under this.
const MAX_PATH_LEN = 512

// ---------------------------------------------------------------------------
// POST /api/events/page-view — basic visit tracking
//
// The SPA fires this on every client-side route change. We record one
// PAGE_VIEW row per navigation so admins can derive visits, repeat users,
// journeys, and engagement. `optionalAuth` resolves the session email when
// present (anonymous visits are recorded with email = NULL). Fire-and-forget:
// we never block the client and always answer 204.
// ---------------------------------------------------------------------------
export function pageViewHandler(req: Request, res: Response): void {
  const body = (req.body ?? {}) as { path?: unknown; ref?: unknown }
  const path =
    typeof body.path === 'string' ? body.path.slice(0, MAX_PATH_LEN) : null

  // No usable path → nothing to record, but still 204 so the client treats
  // it as success and doesn't retry.
  if (path) {
    const ref = typeof body.ref === 'string' ? body.ref.slice(0, MAX_PATH_LEN) : null
    trackEvent(AnalyticsEvent.PAGE_VIEW, req.user?.email, {
      path,
      ...(ref ? { ref } : {}),
    })
  }

  res.status(204).end()
}

router.post('/page-view', optionalAuth, pageViewHandler)

const CALENDAR_API_ID = 'cal-FlrNymwoPAxiNWC'
const LUMA_URL = `https://api.lu.ma/calendar/get-items?calendar_api_id=${CALENDAR_API_ID}&period=future&pagination_limit=4`

// 5 minute in-memory cache. The Luma calendar changes very rarely
// (1-2 events/month), so caching avoids hammering the upstream and
// makes repeat page loads instant. A single dyno is fine; no need to
// share state across instances for a tiny upstream call.
type CacheEntry = { ts: number; payload: unknown }
const CACHE_TTL_MS = 5 * 60 * 1000
let cache: CacheEntry | null = null

interface LumaEntry {
  api_id: string
  event: {
    api_id: string
    name: string
    url: string
    cover_url?: string | null
    social_image_url?: string | null
    start_at: string
    end_at?: string
    timezone?: string | null
    location_type?: string | null
    geo_address_info?: { city_state?: string; full_address?: string } | null
  }
}

router.get('/', async (_req, res) => {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'public, max-age=300')
      res.json(cache.payload)
      return
    }

    const upstream = await fetch(LUMA_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'cpo-connect-hub/1.0 (+https://cpoconnect.club)',
      },
    })

    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream_failed', status: upstream.status })
      return
    }

    const data = (await upstream.json()) as { entries?: LumaEntry[] }
    // Project to just the fields the UI needs — keeps the wire small
    // and shields the client from upstream schema drift.
    const events = (data.entries || []).slice(0, 4).map((entry) => {
      const e = entry.event
      return {
        api_id: e.api_id,
        name: e.name,
        url: e.url,
        cover_url: e.cover_url || e.social_image_url || null,
        start_at: e.start_at,
        timezone: e.timezone || null,
        location_type: e.location_type || null,
        city_state: e.geo_address_info?.city_state || null,
      }
    })

    const payload = { events }
    cache = { ts: Date.now(), payload }
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.json(payload)
  } catch (err) {
    res.status(502).json({ error: 'fetch_failed', message: (err as Error).message })
  }
})

export default router
