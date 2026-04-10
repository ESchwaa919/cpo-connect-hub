// Router-level integration tests for the WETA chat endpoints. These are
// distinct from chat-routes.test.ts — which invokes the handler functions
// directly — in that they spin up the full Express app via `createApp()`,
// hit it over HTTP, and therefore exercise the ACTUAL middleware chain
// (requireAuth, requireIngestAuth, chatAskRateLimit, per-route body parser,
// router mount order). Regressions like "someone dropped requireAuth on
// /ask" or "the 50MB parser leaked to /ask globally" are caught here
// and nowhere else.
//
// Uses the real DB (per the no-DB-mocks hard constraint) and mocks only
// the chatEmbedding / chatSynthesis service wrappers (HTTP-client SDK
// wrappers, allowed per the wave-2 exception).
import './_requireIngestAuth-setup'

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { sign as signCookie } from 'cookie-signature'
import pool from '../../server/db'

// Mock SDK wrappers BEFORE importing createApp so the chat.ts router
// picks up the mocks when it's loaded transitively.
const mocks = vi.hoisted(() => ({
  embedQueryMock: vi.fn(),
  synthesizeAnswerMock: vi.fn(),
}))

vi.mock('../../server/services/chatEmbedding', () => ({
  embedQuery: mocks.embedQueryMock,
  EmbeddingUnavailableError: class extends Error {
    readonly code = 'embedding_unavailable' as const
  },
}))

vi.mock('../../server/services/chatSynthesis', () => ({
  synthesizeAnswer: mocks.synthesizeAnswerMock,
  SynthesisUnavailableError: class extends Error {
    readonly code = 'synthesis_unavailable' as const
  },
}))

import { createApp } from '../../server/app'
import { resetChatAskRateLimits } from '../../server/services/chat-rate-limit'

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

const INGEST_KEY =
  '1111111111111111111111111111111111111111111111111111111111111111'
const TEST_SESSION_SECRET = 'weta-router-test-secret'

function fixedVector(value: number): number[] {
  return new Array(768).fill(value)
}

dbDescribe('chat router integration (live Express app)', () => {
  let server: Server
  let baseUrl: string
  const memberEmail = `weta-router-member-${randomUUID()}@test.local`
  const adminEmail = `weta-router-admin-${randomUUID()}@test.local`
  const insertedSessionIds: string[] = []
  const insertedChatMessageIds: string[] = []
  let memberSessionCookie = ''

  beforeAll(async () => {
    // Env setup for downstream middleware
    process.env.SESSION_SECRET = TEST_SESSION_SECRET
    process.env.ADMIN_EMAILS = adminEmail
    process.env.INGEST_API_KEY = INGEST_KEY

    // Member profile for the happy-path asker
    await pool.query(
      `INSERT INTO cpo_connect.member_profiles (email, name)
       VALUES ($1, 'Router Test Member')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
      [memberEmail],
    )

    // Build two real sessions so requireAuth cookie-path can load them
    const memberSession = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.sessions (email, name, expires_at)
       VALUES ($1, 'Router Test Member', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [memberEmail],
    )
    insertedSessionIds.push(memberSession.rows[0].id)
    memberSessionCookie =
      'cpo_session=s:' + signCookie(memberSession.rows[0].id, TEST_SESSION_SECRET)

    const adminSession = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.sessions (email, name, expires_at)
       VALUES ($1, 'Router Test Admin', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [adminEmail],
    )
    insertedSessionIds.push(adminSession.rows[0].id)

    // One chat_messages row so the askHandler vector search has a hit.
    // Uses channel='leadership_culture' so it doesn't collide with
    // chat-routes.test.ts fixtures (which live in channel='ai' and run
    // in parallel on the shared DB).
    const msg = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_messages
         (channel, author_name, author_email, message_text, sent_at, source_export, content_hash, embedding)
       VALUES ('leadership_culture', 'Router Fixture', $1, 'hello from the router test', NOW(), 'weta-router-test', $2, $3)
       RETURNING id::text`,
      [memberEmail, `router-hash-${randomUUID()}`, `[${fixedVector(0.1).join(',')}]`],
    )
    insertedChatMessageIds.push(msg.rows[0].id)

    // Start the real app on an ephemeral port. serveStatic: false because
    // the dist/ dir may not exist under vitest and the test doesn't need
    // the SPA catch-all.
    const app = createApp({ serveStatic: false })
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s))
    })
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })

    if (insertedChatMessageIds.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.chat_messages WHERE id = ANY($1::bigint[])`,
        [insertedChatMessageIds],
      )
    }
    if (insertedSessionIds.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.sessions WHERE id = ANY($1::uuid[])`,
        [insertedSessionIds],
      )
    }
    await pool.query(
      `DELETE FROM cpo_connect.member_profiles WHERE email IN ($1, $2)`,
      [memberEmail, adminEmail],
    )
  })

  beforeEach(() => {
    mocks.embedQueryMock.mockReset()
    mocks.synthesizeAnswerMock.mockReset()
    // Fresh quota between tests so the 10/min burn from one test doesn't
    // bleed into the next.
    resetChatAskRateLimits(memberEmail)
    resetChatAskRateLimits(adminEmail)
  })

  // ---------------------------------------------------------------------------
  // Auth wiring — requireAuth is actually mounted on /api/chat/ask
  // ---------------------------------------------------------------------------

  it('POST /api/chat/ask returns 401 when no session cookie is present', async () => {
    const res = await fetch(`${baseUrl}/api/chat/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'hi' }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('not_authenticated')
  })

  // ---------------------------------------------------------------------------
  // Rate limit wiring — chatAskRateLimit is actually chained after requireAuth
  // ---------------------------------------------------------------------------

  it('POST /api/chat/ask enforces the 10/min rate limit on authenticated sessions', async () => {
    mocks.embedQueryMock.mockResolvedValue(fixedVector(0.1))
    mocks.synthesizeAnswerMock.mockResolvedValue({
      answer: 'ok',
      model: 'claude-sonnet-4-5',
    })

    // 10 allowed
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: memberSessionCookie,
        },
        body: JSON.stringify({ query: `q${i}` }),
      })
      expect(res.status).toBe(200)
    }

    // 11th blocked
    const blocked = await fetch(`${baseUrl}/api/chat/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: memberSessionCookie,
      },
      body: JSON.stringify({ query: 'one too many' }),
    })
    expect(blocked.status).toBe(429)
    const blockedBody = (await blocked.json()) as {
      error: string
      retryAfterSec: number
    }
    expect(blockedBody.error).toBe('rate_limited')
    expect(blockedBody.retryAfterSec).toBeGreaterThan(0)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
  })

  // ---------------------------------------------------------------------------
  // Ingest auth wiring — requireIngestAuth rejects unauth'd requests
  // ---------------------------------------------------------------------------

  it('POST /api/admin/chat/ingest returns 401 with no cookie AND no X-Ingest-Key header', async () => {
    const res = await fetch(`${baseUrl}/api/admin/chat/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2999-12', messages: [] }),
    })
    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // Body limit scoping — 50MB parser is ONLY on /ingest, NOT on /ask
  // ---------------------------------------------------------------------------

  it('POST /api/chat/ask rejects a 5MB payload with 413 (default ~100KB limit applies)', async () => {
    // Five megabytes of 'a' inside a valid JSON envelope.
    const bigPayload =
      '{"query":"' + 'a'.repeat(5 * 1024 * 1024) + '"}'
    const res = await fetch(`${baseUrl}/api/chat/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: memberSessionCookie,
      },
      body: bigPayload,
    })
    expect(res.status).toBe(413)
  })

  it(
    'POST /api/admin/chat/ingest accepts a 5MB payload (50MB limit applies to this route only)',
    async () => {
      // One valid message padded with 5MB of text in messageText. The ingest
      // handler accepts it and stores it; we assert the body parser was
      // happy and the handler ran to completion (200), then clean up the
      // inserted row. The 30s timeout covers the round trip to Frankfurt
      // with a 5MB payload.
      const bigText = 'x'.repeat(5 * 1024 * 1024)
    const payload = {
      month: '2999-12',
      messages: [
        {
          channel: 'ai',
          authorName: 'Big Body Test',
          messageText: bigText,
          sentAt: '2999-12-05T10:00:00.000Z',
          sourceExport: 'weta-router-big-body',
          embedding: fixedVector(0.9),
        },
      ],
    }

    try {
      const res = await fetch(`${baseUrl}/api/admin/chat/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ingest-Key': INGEST_KEY,
        },
        body: JSON.stringify(payload),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { ingested: number; skipped: number }
      expect(body.ingested).toBe(1)
    } finally {
      await pool.query(
        `DELETE FROM cpo_connect.chat_messages WHERE source_export = 'weta-router-big-body'`,
      )
      await pool.query(
        `DELETE FROM cpo_connect.chat_ingestion_runs WHERE '2999-12' = ANY(source_months)`,
      )
    }
    },
    30_000,
  )
})
