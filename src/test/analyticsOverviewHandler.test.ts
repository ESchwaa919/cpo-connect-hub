// Imported first for its side effects — loads .env and normalizes
// DATABASE_URL before pool is constructed via the downstream import.
import './_requireIngestAuth-setup'

import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import pool from '../../server/db'
import { analyticsOverviewHandler } from '../../server/routes/analytics'
import { makeReq, makeRes, bodyOf } from './_express-mocks'

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

interface Overview {
  windowDays: number
  visits: { total: number; anonymous: number; perDay: { day: string; count: number }[] }
  users: { unique: number; repeat: number }
  engagement: {
    topPaths: { path: string; count: number }[]
    perUser: { email: string; pageViews: number; activeDays: number; lastSeen: string }[]
  }
  journeys: { email: string; steps: { path: string; at: string }[] }[]
}

async function getOverview(): Promise<Overview> {
  const res = makeRes()
  await analyticsOverviewHandler(makeReq(), res)
  expect(res.status).toHaveBeenCalledWith(200)
  return bodyOf(res) as Overview
}

dbDescribe('analyticsOverviewHandler (real DB)', () => {
  const path = `/members/analytics-test-${randomUUID()}`
  const emailA = `weta-an-a-${randomUUID()}@test.local` // active 2 days → repeat
  const emailB = `weta-an-b-${randomUUID()}@test.local` // active 1 day → not repeat

  afterAll(async () => {
    await pool.query(
      `DELETE FROM cpo_connect.events
       WHERE metadata->>'path' = $1`,
      [path],
    )
  })

  it('computes visits, unique/repeat users, and returns well-formed groups', async () => {
    const before = await getOverview()

    // 3 page_view rows for emailA across 2 distinct days (today + yesterday)
    // → repeat. 2 page_view rows for emailB on a single day → unique but not
    // repeat. 1 anonymous (NULL email) page_view. 6 page_view rows total.
    // Plus 1 profile_view for emailA — a non-page event that must NOT count
    // toward visits or emailA's page-view engagement.
    const meta = JSON.stringify({ path })
    await pool.query(
      `INSERT INTO cpo_connect.events (event, email, metadata, created_at) VALUES
         ('page_view', $1, $3::jsonb, NOW()),
         ('page_view', $1, $3::jsonb, NOW()),
         ('page_view', $1, $3::jsonb, NOW() - INTERVAL '1 day'),
         ('page_view', $2, $3::jsonb, NOW()),
         ('page_view', $2, $3::jsonb, NOW()),
         ('page_view', NULL, $3::jsonb, NOW()),
         ('profile_view', $1, $3::jsonb, NOW())`,
      [emailA, emailB, meta],
    )

    const after = await getOverview()

    // Headline visit counts move by exactly what we inserted.
    expect(after.visits.total - before.visits.total).toBe(6)
    expect(after.visits.anonymous - before.visits.anonymous).toBe(1)

    // Two brand-new known emails → unique +2; only emailA spans >1 day → repeat +1.
    expect(after.users.unique - before.users.unique).toBe(2)
    expect(after.users.repeat - before.users.repeat).toBe(1)

    // Structural / type guarantees on the list sections.
    expect(after.windowDays).toBe(30)
    expect(Array.isArray(after.visits.perDay)).toBe(true)
    for (const d of after.visits.perDay) {
      expect(typeof d.day).toBe('string')
      expect(typeof d.count).toBe('number')
    }
    // perDay is ordered ascending by day.
    const days = after.visits.perDay.map((d) => d.day)
    expect([...days].sort()).toEqual(days)

    for (const p of after.engagement.topPaths) {
      expect(typeof p.path).toBe('string')
      expect(typeof p.count).toBe('number')
    }
    for (const u of after.engagement.perUser) {
      expect(typeof u.email).toBe('string')
      expect(typeof u.pageViews).toBe('number')
      expect(typeof u.activeDays).toBe('number')
    }

    // When emailA surfaces in the (capped) per-user list, its engagement must
    // reflect ONLY page views: 3 page_views across 2 days — the extra
    // profile_view must not inflate pageViews to 4 or activeDays.
    const userA = after.engagement.perUser.find((u) => u.email === emailA)
    if (userA) {
      expect(userA.pageViews).toBe(3)
      expect(userA.activeDays).toBe(2)
    }
    for (const j of after.journeys) {
      expect(typeof j.email).toBe('string')
      expect(Array.isArray(j.steps)).toBe(true)
    }
  })
})
