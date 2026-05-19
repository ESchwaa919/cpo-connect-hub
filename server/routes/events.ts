import { Router } from 'express'

const router = Router()

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
