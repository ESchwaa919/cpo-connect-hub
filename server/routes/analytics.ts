import { Router, type Request, type Response } from 'express'
import pool from '../db.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/requireAdmin.ts'

// Rolling window for the visits / users / engagement metrics. Journeys are
// drawn from the most recent activity regardless of window.
const WINDOW = "30 days"

// How many rows each "list" section returns. Kept small — this is a basic
// admin readout, not an analytics product.
const TOP_PATHS_LIMIT = 15
const PER_USER_LIMIT = 25
const JOURNEY_USERS = 10 // most-recently-active distinct users shown
const JOURNEY_STEPS = 12 // most recent paths per user

function sendServerError(res: Response, route: string, err: unknown): void {
  console.error(`${route} error:`, (err as Error).message)
  res.status(500).json({ error: 'internal' })
}

function toIso(value: Date | null): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/** GET /api/admin/analytics/overview — visits, repeat users, journeys, and
 *  engagement, all derived from the shared cpo_connect.events table. One
 *  endpoint feeds the whole admin page in a single round trip from the client. */
export async function analyticsOverviewHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const [
      visitsAgg,
      perDay,
      usersAgg,
      topPaths,
      perUser,
      journeyRows,
    ] = await Promise.all([
      // Total + anonymous page views in the window.
      pool.query<{ total: string; anonymous: string }>(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE email IS NULL)::text AS anonymous
         FROM cpo_connect.events
         WHERE event = 'page_view'
           AND created_at >= NOW() - INTERVAL '${WINDOW}'`,
      ),
      // Visits per day (UTC) in the window.
      pool.query<{ day: string; count: string }>(
        `SELECT
           to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
           COUNT(*)::text AS count
         FROM cpo_connect.events
         WHERE event = 'page_view'
           AND created_at >= NOW() - INTERVAL '${WINDOW}'
         GROUP BY 1
         ORDER BY 1`,
      ),
      // Unique known users + how many were active on more than one day.
      pool.query<{ unique_users: string; repeat_users: string }>(
        `SELECT
           COUNT(*)::text AS unique_users,
           COUNT(*) FILTER (WHERE days > 1)::text AS repeat_users
         FROM (
           SELECT email,
             COUNT(DISTINCT date_trunc('day', created_at AT TIME ZONE 'UTC')) AS days
           FROM cpo_connect.events
           WHERE event = 'page_view' AND email IS NOT NULL
             AND created_at >= NOW() - INTERVAL '${WINDOW}'
           GROUP BY email
         ) t`,
      ),
      // Most visited paths in the window.
      pool.query<{ path: string; count: string }>(
        `SELECT metadata->>'path' AS path, COUNT(*)::text AS count
         FROM cpo_connect.events
         WHERE event = 'page_view' AND metadata->>'path' IS NOT NULL
           AND created_at >= NOW() - INTERVAL '${WINDOW}'
         GROUP BY 1
         ORDER BY COUNT(*) DESC, path
         LIMIT ${TOP_PATHS_LIMIT}`,
      ),
      // Per-user engagement, scoped to page views in the window so it stays
      // consistent with the rest of the page (a login-only user shouldn't
      // appear here, and other event types must not inflate the count).
      pool.query<{
        email: string
        page_views: string
        active_days: string
        last_seen: Date | null
      }>(
        `SELECT email,
           COUNT(*)::text AS page_views,
           COUNT(DISTINCT date_trunc('day', created_at AT TIME ZONE 'UTC'))::text AS active_days,
           MAX(created_at) AS last_seen
         FROM cpo_connect.events
         WHERE event = 'page_view' AND email IS NOT NULL
           AND created_at >= NOW() - INTERVAL '${WINDOW}'
         GROUP BY email
         ORDER BY COUNT(*) DESC, MAX(created_at) DESC
         LIMIT ${PER_USER_LIMIT}`,
      ),
      // Per-user journeys: the most-recently-active distinct users, each with
      // their last JOURNEY_STEPS page views in chronological order. A window
      // function picks the top users and trims each user's steps in SQL so a
      // single hyperactive member can't crowd others out of the result.
      pool.query<{ email: string; path: string; created_at: Date }>(
        `WITH page_views AS (
           SELECT email, metadata->>'path' AS path, created_at
           FROM cpo_connect.events
           WHERE event = 'page_view' AND email IS NOT NULL
             AND metadata->>'path' IS NOT NULL
         ),
         recent_users AS (
           SELECT email, MAX(created_at) AS last_seen
           FROM page_views
           GROUP BY email
           ORDER BY last_seen DESC
           LIMIT ${JOURNEY_USERS}
         ),
         ranked AS (
           SELECT pv.email, pv.path, pv.created_at, ru.last_seen,
             ROW_NUMBER() OVER (
               PARTITION BY pv.email ORDER BY pv.created_at DESC
             ) AS rn
           FROM page_views pv
           JOIN recent_users ru ON ru.email = pv.email
         )
         SELECT email, path, created_at
         FROM ranked
         WHERE rn <= ${JOURNEY_STEPS}
         ORDER BY last_seen DESC, created_at ASC`,
      ),
    ])

    // Rows arrive ordered by user (most-recent-active first) then
    // chronologically within each user, so a simple grouped push rebuilds the
    // journeys in display order.
    const byUser = new Map<string, Array<{ path: string; at: string }>>()
    for (const row of journeyRows.rows) {
      const steps = byUser.get(row.email) ?? []
      steps.push({ path: row.path, at: toIso(row.created_at) })
      byUser.set(row.email, steps)
    }
    const journeys = Array.from(byUser.entries()).map(([email, steps]) => ({
      email,
      steps,
    }))

    res.status(200).json({
      windowDays: 30,
      visits: {
        total: Number(visitsAgg.rows[0]?.total ?? '0'),
        anonymous: Number(visitsAgg.rows[0]?.anonymous ?? '0'),
        perDay: perDay.rows.map((r) => ({
          day: r.day,
          count: Number(r.count),
        })),
      },
      users: {
        unique: Number(usersAgg.rows[0]?.unique_users ?? '0'),
        repeat: Number(usersAgg.rows[0]?.repeat_users ?? '0'),
      },
      engagement: {
        topPaths: topPaths.rows.map((r) => ({
          path: r.path,
          count: Number(r.count),
        })),
        perUser: perUser.rows.map((r) => ({
          email: r.email,
          pageViews: Number(r.page_views),
          activeDays: Number(r.active_days),
          lastSeen: toIso(r.last_seen),
        })),
      },
      journeys,
    })
  } catch (err) {
    sendServerError(res, 'GET /api/admin/analytics/overview', err)
  }
}

const router = Router()
router.get('/overview', requireAuth, requireAdmin, analyticsOverviewHandler)

export default router
