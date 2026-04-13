// Integration tests for server/routes/chat.ts. Uses the REAL database (no
// mocking of server/db per the wave-2 dispatch hard constraint) and mocks
// only the external SDK wrappers — chatEmbedding + chatSynthesis — per
// the pass-2 exception for HTTP-client SDKs.
//
// Reuses the env loader + DATABASE_URL normalizer from requireIngestAuth's
// setup file. If DATABASE_URL is not set, every describe block skips
// cleanly.
import './_requireIngestAuth-setup'

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from 'vitest'
import { randomUUID } from 'node:crypto'
import pool from '../../server/db'

// -----------------------------------------------------------------------------
// Mock external SDK wrappers BEFORE importing the route handlers.
//
// Both classes are redefined inside vi.hoisted so the handler's
// `err instanceof EmbeddingUnavailableError` checks work: the handler
// imports the class from the MOCKED module, and the test throws an
// instance of the SAME mocked class.
// -----------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  class EmbeddingUnavailableError extends Error {
    readonly code = 'embedding_unavailable' as const
    constructor(cause: string) {
      super(`embedding_unavailable: ${cause}`)
      this.name = 'EmbeddingUnavailableError'
      Object.setPrototypeOf(this, new.target.prototype)
    }
  }
  class SynthesisUnavailableError extends Error {
    readonly code = 'synthesis_unavailable' as const
    constructor(cause: string) {
      super(`synthesis_unavailable: ${cause}`)
      this.name = 'SynthesisUnavailableError'
      Object.setPrototypeOf(this, new.target.prototype)
    }
  }
  return {
    embedQueryMock: vi.fn(),
    synthesizeAnswerMock: vi.fn(),
    EmbeddingUnavailableError,
    SynthesisUnavailableError,
  }
})

vi.mock('../../server/services/chatEmbedding', () => ({
  embedQuery: mocks.embedQueryMock,
  EmbeddingUnavailableError: mocks.EmbeddingUnavailableError,
}))

vi.mock('../../server/services/chatSynthesis', () => ({
  synthesizeAnswer: mocks.synthesizeAnswerMock,
  SynthesisUnavailableError: mocks.SynthesisUnavailableError,
}))

import {
  askHandler,
  promptTilesHandler,
  ingestHandler,
  ingestionRunsHandler,
} from '../../server/routes/chat'
import { makeRes, makeReq, bodyOf } from './_express-mocks'

/** Fixed 768-dim vector of 0.1s — good enough for pgvector to index and
 *  order by, and deterministic enough for tests to assert on. */
function fixedVector(value: number): number[] {
  return new Array(768).fill(value)
}

/** Makes a 768-dim vector that is *not* a scalar multiple of the seed
 *  vectors used by the beforeAll block (which are all constant 0.1x).
 *  The query-time mock returns the same vector so the new row wins cosine
 *  ordering over the seed rows. */
function uniqueVector(slot: number): number[] {
  const v = new Array(768).fill(0.01)
  // Place a distinctive non-zero at an index derived from `slot` so
  // different test rows don't collide with each other either.
  v[slot % 768] = 0.99
  return v
}

// -----------------------------------------------------------------------------
// Shared DB availability guard
// -----------------------------------------------------------------------------

const dbAvailable = !!process.env.DATABASE_URL
const dbDescribe = dbAvailable ? describe : describe.skip

// -----------------------------------------------------------------------------
// askHandler
// -----------------------------------------------------------------------------

dbDescribe('askHandler', () => {
  const testEmail = `weta-ask-${randomUUID()}@test.local`
  const testSourceExport = `weta-ask-test-${randomUUID()}`
  const insertedMessageIds: string[] = []

  beforeAll(async () => {
    // Ensure the member exists with default opt-outs (both false)
    await pool.query(
      `INSERT INTO cpo_connect.member_profiles (email, name)
       VALUES ($1, 'WETA Ask Test User')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
      [testEmail],
    )

    // Insert 3 chat messages with distinct embeddings so pgvector cosine
    // distance gives us a deterministic ordering.
    for (let i = 0; i < 3; i++) {
      const vec = fixedVector(0.1 + i * 0.01)
      const result = await pool.query<{ id: string }>(
        `INSERT INTO cpo_connect.chat_messages
          (channel, author_name, author_email, message_text, sent_at, source_export, content_hash, embedding)
         VALUES ('ai', $1, $2, $3, NOW() - INTERVAL '1 day' * $4, $5, $6, $7)
         RETURNING id`,
        [
          `WETA Test Author ${i}`,
          testEmail,
          `WETA ask test message ${i} ${randomUUID()}`,
          i,
          testSourceExport,
          `weta-ask-hash-${randomUUID()}`,
          `[${vec.join(',')}]`,
        ],
      )
      insertedMessageIds.push(result.rows[0].id)
    }
  })

  afterAll(async () => {
    if (insertedMessageIds.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.chat_messages WHERE id = ANY($1::bigint[])`,
        [insertedMessageIds],
      )
    }
    await pool.query(
      `DELETE FROM cpo_connect.member_profiles WHERE email = $1`,
      [testEmail],
    )
  })

  beforeEach(async () => {
    mocks.embedQueryMock.mockReset()
    mocks.synthesizeAnswerMock.mockReset()
    // Reset opt-out flags between tests
    await pool.query(
      `UPDATE cpo_connect.member_profiles
         SET chat_identification_opted_out = false,
             chat_query_logging_opted_out = false
       WHERE email = $1`,
      [testEmail],
    )
  })

  it('returns 400 on empty query', async () => {
    const req = makeReq({
      body: { query: '' },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(bodyOf(res)).toMatchObject({ error: 'bad_query' })
  })

  it('returns 400 on query over 500 chars', async () => {
    const req = makeReq({
      body: { query: 'x'.repeat(501) },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 400 bad_query on malformed dateFrom', async () => {
    const req = makeReq({
      body: { query: 'hi', dateFrom: 'not-a-date' },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(bodyOf(res)).toMatchObject({ error: 'bad_query' })
    // Must short-circuit before calling the SDK wrappers.
    expect(mocks.embedQueryMock).not.toHaveBeenCalled()
  })

  it('returns 400 bad_query on malformed dateTo', async () => {
    const req = makeReq({
      body: { query: 'hi', dateTo: 'banana' },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(bodyOf(res)).toMatchObject({ error: 'bad_query' })
    expect(mocks.embedQueryMock).not.toHaveBeenCalled()
  })

  it('accepts well-formed ISO dateFrom/dateTo on the happy path', async () => {
    mocks.embedQueryMock.mockResolvedValueOnce(fixedVector(0.1))
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'ok',
      model: 'claude-sonnet-4-5',
    })

    const req = makeReq({
      body: {
        query: 'hi',
        channel: 'ai',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    // Either 200 (rows found) or 200 with empty-state shape — both are
    // valid outcomes for the filter window. The critical assertion is
    // that we did NOT short-circuit with a 400.
    expect(res.status).toHaveBeenCalledWith(200)
    expect(mocks.embedQueryMock).toHaveBeenCalledTimes(1)
  })

  it('returns 503 embedding_unavailable with Retry-After header on embed error', async () => {
    mocks.embedQueryMock.mockRejectedValueOnce(
      new mocks.EmbeddingUnavailableError('gemini 429'),
    )

    const req = makeReq({
      body: { query: 'anything' },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30')
    expect(bodyOf(res)).toMatchObject({
      error: 'embedding_unavailable',
      retryAfterSec: 30,
    })
    expect(mocks.synthesizeAnswerMock).not.toHaveBeenCalled()
  })

  it('returns 503 synthesis_unavailable on claude error', async () => {
    mocks.embedQueryMock.mockResolvedValueOnce(fixedVector(0.1))
    mocks.synthesizeAnswerMock.mockRejectedValueOnce(
      new mocks.SynthesisUnavailableError('claude timeout'),
    )

    const req = makeReq({
      body: { query: 'anything', channel: 'ai' },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(bodyOf(res)).toMatchObject({ error: 'synthesis_unavailable' })
  })

  it('returns 200 empty-state shape when vector search finds zero rows', async () => {
    mocks.embedQueryMock.mockResolvedValueOnce(fixedVector(0.5))

    const req = makeReq({
      body: { query: 'a', channel: 'nonexistent-channel' },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as {
      answer: string | null
      sources: unknown[]
      message: string
      model: null
    }
    expect(body.answer).toBeNull()
    expect(body.sources).toEqual([])
    expect(body.message).toMatch(/No relevant chat history/)
    expect(body.model).toBeNull()
    expect(mocks.synthesizeAnswerMock).not.toHaveBeenCalled()
  })

  it('returns the synthesized answer with sources on the happy path', async () => {
    mocks.embedQueryMock.mockResolvedValueOnce(fixedVector(0.1))
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'People say interesting things [1].',
      model: 'claude-sonnet-4-5',
    })

    const req = makeReq({
      body: { query: 'anything', channel: 'ai', limit: 3 },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as {
      answer: string
      sources: Array<{ authorDisplayName: string; authorOptedOut: boolean }>
      model: string
    }
    expect(body.answer).toContain('People say')
    expect(body.model).toBe('claude-sonnet-4-5')
    expect(body.sources.length).toBeGreaterThan(0)
    // Default opt-out is false — real author names should surface
    expect(body.sources[0].authorDisplayName).toMatch(/WETA Test Author/)
    expect(body.sources[0].authorOptedOut).toBe(false)

    // synthesizeAnswer was called with the sources list
    expect(mocks.synthesizeAnswerMock).toHaveBeenCalledTimes(1)
    const synthCall = mocks.synthesizeAnswerMock.mock.calls[0][0] as {
      sources: unknown[]
    }
    expect(synthCall.sources.length).toBeGreaterThan(0)
  })

  it('renders sources as "A member" when chat_identification_opted_out is true', async () => {
    // Flip the identification opt-out on the test member
    await pool.query(
      `UPDATE cpo_connect.member_profiles
         SET chat_identification_opted_out = true
       WHERE email = $1`,
      [testEmail],
    )

    mocks.embedQueryMock.mockResolvedValueOnce(fixedVector(0.1))
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'ok',
      model: 'claude-sonnet-4-5',
    })

    const req = makeReq({
      body: { query: 'q', channel: 'ai' },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    const body = bodyOf(res) as {
      sources: Array<{ authorDisplayName: string; authorOptedOut: boolean }>
    }
    expect(body.sources[0].authorDisplayName).toBe('A member')
    expect(body.sources[0].authorOptedOut).toBe(true)
  })

  it('resolves authorDisplayName via the members table when sender_phone matches', async () => {
    // Unique phone so the test is hermetic from other members rows.
    const phone = `+4477${randomUUID().replace(/[^0-9]/g, '').slice(0, 9).padEnd(9, '0')}`
    await pool.query(
      `INSERT INTO cpo_connect.members (phone, display_name, email)
       VALUES ($1, 'Live Directory Name', NULL)
       ON CONFLICT (phone) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [phone],
    )

    // Distinct non-parallel vector so pgvector's cosine ordering puts
    // THIS row first. The seed rows are all scalar multiples of each
    // other so they'd all tie at cosine-similarity=1 against a constant
    // query vector — uniqueVector() places a spike at a unique index.
    const uniqueVec = uniqueVector(100)
    const hash = `weta-ask-resolve-${randomUUID()}`
    const insertRes = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_messages
         (channel, author_name, message_text, sent_at, source_export,
          content_hash, embedding, sender_phone, sender_display_name)
       VALUES ('ai', 'Stale Snapshot Name', $1, NOW(), 'weta-ask-resolve',
               $2, $3::vector, $4, 'Stale Snapshot Name')
       RETURNING id`,
      [
        `weta-ask-resolve-text-${randomUUID()}`,
        hash,
        `[${uniqueVec.join(',')}]`,
        phone,
      ],
    )
    insertedMessageIds.push(insertRes.rows[0].id)

    mocks.embedQueryMock.mockResolvedValueOnce(uniqueVec)
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'ok',
      model: 'claude-sonnet-4-5',
    })

    const req = makeReq({
      body: { query: 'what did people say', channel: 'ai', limit: 1 },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as {
      sources: Array<{ authorDisplayName: string }>
    }
    expect(body.sources[0].authorDisplayName).toBe('Live Directory Name')

    await pool.query(`DELETE FROM cpo_connect.members WHERE phone = $1`, [
      phone,
    ])
  })

  it('sanitizes raw-phone author_name fallback — no raw digits surface', async () => {
    const uniqueVec = uniqueVector(200)
    const hash = `weta-ask-sanitize-${randomUUID()}`
    const rawAuthor = '+44 7911 123456'
    const insertRes = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_messages
         (channel, author_name, message_text, sent_at, source_export,
          content_hash, embedding, sender_phone, sender_display_name)
       VALUES ('ai', $1, $2, NOW(), 'weta-ask-sanitize',
               $3, $4::vector, NULL, NULL)
       RETURNING id`,
      [
        rawAuthor,
        `weta-ask-sanitize-text-${randomUUID()}`,
        hash,
        `[${uniqueVec.join(',')}]`,
      ],
    )
    insertedMessageIds.push(insertRes.rows[0].id)

    mocks.embedQueryMock.mockResolvedValueOnce(uniqueVec)
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'ok',
      model: 'claude-sonnet-4-5',
    })

    const req = makeReq({
      body: { query: 'anything', channel: 'ai', limit: 1 },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    const body = bodyOf(res) as {
      sources: Array<{ authorDisplayName: string }>
    }
    const displayed = body.sources[0].authorDisplayName
    // The raw phone must not appear verbatim anywhere in the response.
    expect(displayed).not.toContain('7911')
    expect(displayed).not.toContain('123456')
    // Must be the sanitized mask: "+44 ···· ···456" or similar.
    expect(displayed).toMatch(/^\+44 ·+ ·+456$/)
  })

  it('accepts a channels[] array and filters rows using WHERE channel = ANY($)', async () => {
    const uniqueVec = uniqueVector(300)
    const hash = `weta-ask-channels-${randomUUID()}`
    const insertRes = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_messages
         (channel, author_name, message_text, sent_at, source_export,
          content_hash, embedding, sender_phone, sender_display_name)
       VALUES ('leadership_culture', 'WETA Channels Test', $1, NOW(),
               'weta-ask-channels', $2, $3::vector, NULL, NULL)
       RETURNING id`,
      [
        `weta-ask-channels-text-${randomUUID()}`,
        hash,
        `[${uniqueVec.join(',')}]`,
      ],
    )
    insertedMessageIds.push(insertRes.rows[0].id)

    mocks.embedQueryMock.mockResolvedValueOnce(uniqueVec)
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'ok',
      model: 'claude-sonnet-4-5',
    })

    const req = makeReq({
      body: {
        query: 'anything',
        channels: ['ai', 'leadership_culture'],
        limit: 1,
      },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as {
      sources: Array<{ channel: string; authorDisplayName: string }>
    }
    expect(body.sources.length).toBeGreaterThan(0)
    // At least one source from the requested channels set.
    const channels = body.sources.map((s) => s.channel)
    expect(channels.some((c) => c === 'leadership_culture' || c === 'ai')).toBe(
      true,
    )
  })

  it('respects chat_query_logging_opted_out by redacting the events row', async () => {
    // Flip query-logging opt-out
    await pool.query(
      `UPDATE cpo_connect.member_profiles
         SET chat_query_logging_opted_out = true
       WHERE email = $1`,
      [testEmail],
    )

    mocks.embedQueryMock.mockResolvedValueOnce(fixedVector(0.1))
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'ok',
      model: 'claude-sonnet-4-5',
    })

    const uniqueQuery = `weta-test-${randomUUID()}-should-not-be-logged`
    const req = makeReq({
      body: { query: uniqueQuery, channel: 'ai' },
      user: { id: 's', email: testEmail, name: 'W' },
    })
    const res = makeRes()
    await askHandler(req, res)

    // Event logging is fire-and-forget — poll for the redacted row (with
    // exponential-ish backoff) instead of a fixed sleep that would flake
    // on slow network round trips.
    let redactedResult: { rows: Array<{ metadata: Record<string, unknown> }> } = { rows: [] }
    for (let attempt = 0; attempt < 20; attempt++) {
      redactedResult = await pool.query<{ metadata: Record<string, unknown> }>(
        `SELECT metadata FROM cpo_connect.events
         WHERE email = $1 AND event = 'chat_query_redacted'
         ORDER BY created_at DESC LIMIT 1`,
        [testEmail],
      )
      if (redactedResult.rows.length > 0) break
      await new Promise((r) => setTimeout(r, 25))
    }

    expect(redactedResult.rows.length).toBeGreaterThan(0)
    const metadata = redactedResult.rows[0].metadata
    expect(metadata).toHaveProperty('char_count', uniqueQuery.length)
    expect(metadata).not.toHaveProperty('query')

    const leakedResult = await pool.query<{ id: string }>(
      `SELECT id FROM cpo_connect.events
       WHERE email = $1 AND event = 'chat_query' AND metadata->>'query' = $2`,
      [testEmail, uniqueQuery],
    )
    expect(leakedResult.rows.length).toBe(0)

    // Cleanup — the test inserted events
    await pool.query(
      `DELETE FROM cpo_connect.events WHERE email = $1`,
      [testEmail],
    )
  })
})

// -----------------------------------------------------------------------------
// promptTilesHandler
// -----------------------------------------------------------------------------

dbDescribe('promptTilesHandler', () => {
  const crossChannelQuery = `WETA test tile xchannel ${randomUUID()}`
  const aiOnlyQuery = `WETA test tile ai ${randomUUID()}`
  const generalOnlyQuery = `WETA test tile general ${randomUUID()}`
  const insertedTileIds: string[] = []

  beforeAll(async () => {
    // 1 cross-channel (NULL channel) + 2 channel-specific tiles so we can
    // verify the filter shape.
    const rows = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_prompt_tiles
         (scope, channel, title, query, sort_order)
       VALUES
         ('current', NULL,      'WETA Current Cross-Channel', $1, 997),
         ('current', 'ai',      'WETA Current AI Only',       $2, 998),
         ('current', 'general', 'WETA Current General Only',  $3, 999)
       RETURNING id::text`,
      [crossChannelQuery, aiOnlyQuery, generalOnlyQuery],
    )
    for (const row of rows.rows) insertedTileIds.push(row.id)
  })

  afterAll(async () => {
    if (insertedTileIds.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.chat_prompt_tiles WHERE id = ANY($1::bigint[])`,
        [insertedTileIds],
      )
    }
  })

  it('returns current + evergreen split with the seed tiles present', async () => {
    const req = makeReq({ query: {} })
    const res = makeRes()
    await promptTilesHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as {
      current: Array<{ id: string; title: string; query: string }>
      evergreen: Array<{ id: string; title: string; query: string }>
    }

    // Assert on specific titles from migration 009's evergreen seed rather
    // than a count — seeds could change, but these 4 titles are the
    // documented Phase 1 set.
    const evergreenTitles = body.evergreen.map((t) => t.title)
    expect(evergreenTitles).toContain('AI tooling debates')
    expect(evergreenTitles).toContain('Hiring & the CV crisis')
    expect(evergreenTitles).toContain('Burnout & sustainable work')
    expect(evergreenTitles).toContain('PM tool recommendations')

    expect(body.current.find((t) => t.query === crossChannelQuery)).toBeDefined()
  })

  it('returns ALL tiles (cross-channel + every channel-specific) when no channel is supplied', async () => {
    // Per the spec, the default response must include channel-specific
    // tiles from every channel. An earlier draft collapsed the WHERE to
    // `channel IS NULL` which dropped them — codex pass 1 BLOCKER.
    const req = makeReq({ query: {} })
    const res = makeRes()
    await promptTilesHandler(req, res)

    const body = bodyOf(res) as {
      current: Array<{ query: string }>
    }
    const queries = body.current.map((t) => t.query)
    expect(queries).toContain(crossChannelQuery)
    expect(queries).toContain(aiOnlyQuery)
    expect(queries).toContain(generalOnlyQuery)
  })

  it('returns cross-channel + only the requested channel-specific tiles when channel=ai', async () => {
    const req = makeReq({ query: { channel: 'ai' } })
    const res = makeRes()
    await promptTilesHandler(req, res)

    const body = bodyOf(res) as {
      current: Array<{ query: string }>
    }
    const queries = body.current.map((t) => t.query)
    expect(queries).toContain(crossChannelQuery)
    expect(queries).toContain(aiOnlyQuery)
    expect(queries).not.toContain(generalOnlyQuery)
  })
})

// -----------------------------------------------------------------------------
// ingestHandler
// -----------------------------------------------------------------------------

dbDescribe('ingestHandler', () => {
  const testMonth = '2999-12'
  const testSourceExport = `weta-ingest-test-${randomUUID()}`

  beforeEach(async () => {
    // Clean up any leftovers from previous runs that might collide on
    // content_hash (the hash ignores sourceExport, so stale rows from a
    // previous test with the same channel+author+sentAt+text would
    // prevent fresh inserts).
    await pool.query(
      `DELETE FROM cpo_connect.chat_messages WHERE source_export = $1`,
      [testSourceExport],
    )
    await pool.query(
      `DELETE FROM cpo_connect.chat_ingestion_runs WHERE $1 = ANY(source_months)`,
      [testMonth],
    )
  })

  afterAll(async () => {
    await pool.query(
      `DELETE FROM cpo_connect.chat_messages WHERE source_export = $1`,
      [testSourceExport],
    )
    await pool.query(
      `DELETE FROM cpo_connect.chat_ingestion_runs WHERE $1 = ANY(source_months)`,
      [testMonth],
    )
  })

  it('rejects a bad month format with 400', async () => {
    const req = makeReq({
      body: { month: 'nope', messages: [] },
      user: { id: 's', email: 'script:ingest', name: 'Script' },
    })
    const res = makeRes()
    await ingestHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(bodyOf(res)).toMatchObject({ error: 'bad_month' })
  })

  it('ingests valid messages and writes a success run row', async () => {
    const uniqueText = `weta-ingest-msg-${randomUUID()}`
    const req = makeReq({
      body: {
        month: testMonth,
        sourceExports: [testSourceExport],
        messages: [
          {
            channel: 'ai',
            authorName: 'WETA Ingest Bot',
            messageText: uniqueText,
            sentAt: '2999-12-01T12:00:00.000Z',
            sourceExport: testSourceExport,
            embedding: fixedVector(0.2),
          },
        ],
      },
      user: { id: 's', email: 'script:ingest', name: 'Script' },
    })
    const res = makeRes()
    await ingestHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as {
      runId: number
      ingested: number
      skipped: number
    }
    expect(body.ingested).toBe(1)
    expect(body.skipped).toBe(0)
    // runId is numeric per the spec's public API shape (not a bigint
    // string). Codex pass 3 IMPORTANT.
    expect(typeof body.runId).toBe('number')
    expect(Number.isInteger(body.runId)).toBe(true)

    // Row present in chat_messages
    const msgResult = await pool.query(
      `SELECT channel, author_name FROM cpo_connect.chat_messages
       WHERE message_text = $1`,
      [uniqueText],
    )
    expect(msgResult.rows.length).toBe(1)

    // Run row updated to success
    const runResult = await pool.query<{ status: string }>(
      `SELECT status FROM cpo_connect.chat_ingestion_runs WHERE id = $1`,
      [body.runId],
    )
    expect(runResult.rows[0]?.status).toBe('success')
  })

  it('skips rows with a malformed sentAt instead of crashing the run', async () => {
    const goodText = `weta-sentAt-good-${randomUUID()}`
    const badText = `weta-sentAt-bad-${randomUUID()}`
    const req = makeReq({
      body: {
        month: testMonth,
        messages: [
          {
            channel: 'ai',
            authorName: 'Good Timestamp',
            messageText: goodText,
            sentAt: '2999-12-15T09:00:00.000Z',
            sourceExport: testSourceExport,
            embedding: fixedVector(0.4),
          },
          {
            channel: 'ai',
            authorName: 'Bad Timestamp',
            messageText: badText,
            sentAt: 'not-a-real-date',
            sourceExport: testSourceExport,
            embedding: fixedVector(0.4),
          },
        ],
      },
      user: { id: 's', email: 'script:ingest', name: 'Script' },
    })
    const res = makeRes()
    await ingestHandler(req, res)

    // Must be a successful run (200), not a Postgres timestamptz parse
    // error bubbling up as a 500.
    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as { ingested: number; skipped: number }
    expect(body.ingested).toBe(1)
    expect(body.skipped).toBe(1)

    // Only the good row should be persisted.
    const goodRow = await pool.query(
      `SELECT 1 FROM cpo_connect.chat_messages WHERE message_text = $1`,
      [goodText],
    )
    expect(goodRow.rows.length).toBe(1)
    const badRow = await pool.query(
      `SELECT 1 FROM cpo_connect.chat_messages WHERE message_text = $1`,
      [badText],
    )
    expect(badRow.rows.length).toBe(0)
  })

  it('skips rows with missing sourceExport, wrong embedding size, or missing channel', async () => {
    const req = makeReq({
      body: {
        month: testMonth,
        messages: [
          // Missing sourceExport
          {
            channel: 'ai',
            authorName: 'x',
            messageText: `skip-1-${randomUUID()}`,
            sentAt: '2999-12-01T12:00:00.000Z',
            embedding: fixedVector(0.2),
          },
          // Wrong embedding length
          {
            channel: 'ai',
            authorName: 'x',
            messageText: `skip-2-${randomUUID()}`,
            sentAt: '2999-12-01T12:00:00.000Z',
            sourceExport: testSourceExport,
            embedding: [0.1, 0.2],
          },
          // Missing channel
          {
            channel: '',
            authorName: 'x',
            messageText: `skip-3-${randomUUID()}`,
            sentAt: '2999-12-01T12:00:00.000Z',
            sourceExport: testSourceExport,
            embedding: fixedVector(0.2),
          },
        ],
      },
      user: { id: 's', email: 'script:ingest', name: 'Script' },
    })
    const res = makeRes()
    await ingestHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as { ingested: number; skipped: number }
    expect(body.ingested).toBe(0)
    expect(body.skipped).toBe(3)
  })

  it('deduplicates via ON CONFLICT (content_hash)', async () => {
    const uniqueText = `weta-dedup-msg-${randomUUID()}`
    const makeMessage = () => ({
      channel: 'ai',
      authorName: 'Dedup Test',
      messageText: uniqueText,
      sentAt: '2999-12-02T12:00:00.000Z',
      sourceExport: testSourceExport,
      embedding: fixedVector(0.3),
    })

    // First ingest — should succeed
    const firstRes = makeRes()
    await ingestHandler(
      makeReq({
        body: { month: testMonth, messages: [makeMessage()] },
        user: { id: 's', email: 'script:ingest', name: 'Script' },
      }),
      firstRes,
    )
    expect((bodyOf(firstRes) as { ingested: number }).ingested).toBe(1)

    // Second ingest with the same row — should dedupe to skipped
    const secondRes = makeRes()
    await ingestHandler(
      makeReq({
        body: { month: testMonth, messages: [makeMessage()] },
        user: { id: 's', email: 'script:ingest', name: 'Script' },
      }),
      secondRes,
    )
    const secondBody = bodyOf(secondRes) as { ingested: number; skipped: number }
    expect(secondBody.ingested).toBe(0)
    expect(secondBody.skipped).toBe(1)
  })

  it('marks the run as failed and rolls back when promptTiles refresh throws', async () => {
    // Snapshot existing current-scope tiles so the test doesn't corrupt
    // them if the rollback is partial.
    const snapshot = await pool.query<{
      scope: string
      channel: string | null
      title: string
      query: string
      sort_order: number
    }>(
      `SELECT scope, channel, title, query, sort_order
       FROM cpo_connect.chat_prompt_tiles
       WHERE scope = 'current'
       ORDER BY sort_order, id`,
    )
    const snapshotCount = snapshot.rows.length

    try {
      // A tile with a null `title` violates the NOT NULL constraint on
      // chat_prompt_tiles.title and forces refreshCurrentPromptTiles to
      // throw inside its transaction, exercising the ROLLBACK + outer
      // catch block that flips the run row to 'failed'.
      const req = makeReq({
        body: {
          month: testMonth,
          messages: [],
          promptTiles: [
            {
              scope: 'current',
              channel: null,
              title: null as unknown as string,
              query: `weta-bad-tile-${randomUUID()}`,
            },
          ],
        },
        user: { id: 's', email: 'script:ingest', name: 'Script' },
      })
      const res = makeRes()
      await ingestHandler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)

      // The run row for this month should be marked 'failed' with a
      // non-empty error_message.
      const runResult = await pool.query<{
        status: string
        error_message: string | null
      }>(
        `SELECT status, error_message FROM cpo_connect.chat_ingestion_runs
         WHERE $1 = ANY(source_months) AND status = 'failed'
         ORDER BY run_started_at DESC LIMIT 1`,
        [testMonth],
      )
      expect(runResult.rows.length).toBe(1)
      expect(runResult.rows[0].error_message).toBeTruthy()

      // The pre-existing scope='current' tiles must be untouched — the
      // transaction rolled back, so DELETE was never committed.
      const afterCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM cpo_connect.chat_prompt_tiles
         WHERE scope = 'current'`,
      )
      expect(Number(afterCount.rows[0].count)).toBe(snapshotCount)
    } finally {
      // Defensive: if the transaction didn't roll back perfectly, restore
      // the snapshot. No-op when the test passed as expected.
      await pool.query(
        `DELETE FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`,
      )
      for (const row of snapshot.rows) {
        await pool.query(
          `INSERT INTO cpo_connect.chat_prompt_tiles
             (scope, channel, title, query, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.scope, row.channel, row.title, row.query, row.sort_order],
        )
      }
    }
  })

  it('clears all current-scope tiles when promptTiles: [] is explicitly supplied', async () => {
    // Snapshot existing current tiles so we can restore at the end.
    const snapshot = await pool.query<{
      scope: string
      channel: string | null
      title: string
      query: string
      sort_order: number
    }>(
      `SELECT scope, channel, title, query, sort_order
       FROM cpo_connect.chat_prompt_tiles
       WHERE scope = 'current'
       ORDER BY sort_order, id`,
    )

    try {
      // Pre-seed 3 current-scope tiles so we have something to delete.
      await pool.query(
        `DELETE FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`,
      )
      await pool.query(
        `INSERT INTO cpo_connect.chat_prompt_tiles
           (scope, channel, title, query, sort_order)
         VALUES
           ('current', NULL, 'WETA Clear-Test A', $1, 1),
           ('current', NULL, 'WETA Clear-Test B', $2, 2),
           ('current', NULL, 'WETA Clear-Test C', $3, 3)`,
        [
          `weta-clear-a-${randomUUID()}`,
          `weta-clear-b-${randomUUID()}`,
          `weta-clear-c-${randomUUID()}`,
        ],
      )

      // Sanity — 3 rows inserted
      const before = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM cpo_connect.chat_prompt_tiles
         WHERE scope = 'current'`,
      )
      expect(Number(before.rows[0].count)).toBe(3)

      // Ingest with an explicitly-empty promptTiles array
      const req = makeReq({
        body: {
          month: testMonth,
          messages: [],
          promptTiles: [],
        },
        user: { id: 's', email: 'script:ingest', name: 'Script' },
      })
      const res = makeRes()
      await ingestHandler(req, res)
      expect(res.status).toHaveBeenCalledWith(200)

      // All 3 current-scope rows should be gone
      const after = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM cpo_connect.chat_prompt_tiles
         WHERE scope = 'current'`,
      )
      expect(Number(after.rows[0].count)).toBe(0)
    } finally {
      // Restore whatever was there before the test ran
      await pool.query(
        `DELETE FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`,
      )
      for (const row of snapshot.rows) {
        await pool.query(
          `INSERT INTO cpo_connect.chat_prompt_tiles
             (scope, channel, title, query, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.scope, row.channel, row.title, row.query, row.sort_order],
        )
      }
    }
  })

  it('does not touch current-scope tiles when promptTiles field is omitted entirely', async () => {
    const snapshot = await pool.query<{
      scope: string
      channel: string | null
      title: string
      query: string
      sort_order: number
    }>(
      `SELECT scope, channel, title, query, sort_order
       FROM cpo_connect.chat_prompt_tiles
       WHERE scope = 'current'
       ORDER BY sort_order, id`,
    )

    const testTileQueryA = `weta-omit-a-${randomUUID()}`
    const testTileQueryB = `weta-omit-b-${randomUUID()}`
    try {
      await pool.query(
        `DELETE FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`,
      )
      await pool.query(
        `INSERT INTO cpo_connect.chat_prompt_tiles
           (scope, channel, title, query, sort_order)
         VALUES
           ('current', NULL, 'WETA Omit-Test A', $1, 1),
           ('current', NULL, 'WETA Omit-Test B', $2, 2)`,
        [testTileQueryA, testTileQueryB],
      )

      // Ingest without the promptTiles field at all
      const req = makeReq({
        body: {
          month: testMonth,
          messages: [],
        },
        user: { id: 's', email: 'script:ingest', name: 'Script' },
      })
      const res = makeRes()
      await ingestHandler(req, res)
      expect(res.status).toHaveBeenCalledWith(200)

      // Both rows still present — omitted field is a no-op, not a clear
      const queries = await pool.query<{ query: string }>(
        `SELECT query FROM cpo_connect.chat_prompt_tiles
         WHERE scope = 'current'`,
      )
      const queryValues = queries.rows.map((r) => r.query)
      expect(queryValues).toContain(testTileQueryA)
      expect(queryValues).toContain(testTileQueryB)
    } finally {
      await pool.query(
        `DELETE FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`,
      )
      for (const row of snapshot.rows) {
        await pool.query(
          `INSERT INTO cpo_connect.chat_prompt_tiles
             (scope, channel, title, query, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.scope, row.channel, row.title, row.query, row.sort_order],
        )
      }
    }
  })

  it('atomically refreshes current-scope prompt tiles when promptTiles is provided', async () => {
    // Snapshot any pre-existing current-scope tiles on the shared DB so we
    // can restore them after. The ingest handler DELETEs all scope='current'
    // rows inside its transaction, and we don't want a test run to wipe
    // production data.
    const snapshot = await pool.query<{
      scope: string
      channel: string | null
      title: string
      query: string
      sort_order: number
    }>(
      `SELECT scope, channel, title, query, sort_order
       FROM cpo_connect.chat_prompt_tiles
       WHERE scope = 'current'
       ORDER BY sort_order, id`,
    )

    try {
      const req = makeReq({
        body: {
          month: testMonth,
          messages: [],
          promptTiles: [
            {
              scope: 'current',
              channel: null,
              title: 'WETA Ingest Test Tile A',
              query: `weta-tile-a-${randomUUID()}`,
            },
            {
              scope: 'current',
              channel: null,
              title: 'WETA Ingest Test Tile B',
              query: `weta-tile-b-${randomUUID()}`,
            },
          ],
        },
        user: { id: 's', email: 'script:ingest', name: 'Script' },
      })
      const res = makeRes()
      await ingestHandler(req, res)
      expect(res.status).toHaveBeenCalledWith(200)

      const tilesResult = await pool.query<{ title: string }>(
        `SELECT title FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`,
      )
      const titles = tilesResult.rows.map((r) => r.title)
      expect(titles).toContain('WETA Ingest Test Tile A')
      expect(titles).toContain('WETA Ingest Test Tile B')
      // And the old tiles are gone — atomic replace semantics.
      expect(titles.length).toBe(2)
    } finally {
      // Restore the snapshot, regardless of test outcome.
      await pool.query(
        `DELETE FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`,
      )
      if (snapshot.rows.length > 0) {
        for (const row of snapshot.rows) {
          await pool.query(
            `INSERT INTO cpo_connect.chat_prompt_tiles
               (scope, channel, title, query, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [row.scope, row.channel, row.title, row.query, row.sort_order],
          )
        }
      }
    }
  })
})

// -----------------------------------------------------------------------------
// ingestionRunsHandler
// -----------------------------------------------------------------------------

dbDescribe('ingestionRunsHandler', () => {
  const testMonth = '2999-11'
  const adminEmail = `weta-runs-admin-${randomUUID()}@test.local`
  const adminDisplayName = `WETA Runs Admin ${randomUUID()}`
  const unknownEmail = `weta-runs-unknown-${randomUUID()}@test.local`

  const insertedRunIds: number[] = []
  let adminRunId = 0
  let scriptRunId = 0
  let unknownRunId = 0

  beforeAll(async () => {
    // Admin row in member_profiles for the JOIN fallback
    await pool.query(
      `INSERT INTO cpo_connect.member_profiles (email, name)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
      [adminEmail, adminDisplayName],
    )

    // Case 1: run triggered by an admin with a profile → joins to display name
    const adminRun = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_ingestion_runs
         (triggered_by_email, source_months, status,
          messages_ingested, messages_skipped, run_completed_at)
       VALUES ($1, ARRAY[$2], 'success', 42, 3, NOW())
       RETURNING id`,
      [adminEmail, testMonth],
    )
    adminRunId = Number(adminRun.rows[0].id)
    insertedRunIds.push(adminRunId)

    // Case 2: run triggered by the headless ingestion script → 'Ingestion Script' literal
    const scriptRun = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_ingestion_runs
         (triggered_by_email, source_months, status,
          messages_ingested, messages_skipped, run_completed_at)
       VALUES ('script:ingest', ARRAY[$1], 'success', 10, 0, NOW())
       RETURNING id`,
      [testMonth],
    )
    scriptRunId = Number(scriptRun.rows[0].id)
    insertedRunIds.push(scriptRunId)

    // Case 3: run triggered by an email that has no member_profile row →
    // falls back to the raw email for debuggability
    const unknownRun = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_ingestion_runs
         (triggered_by_email, source_months, status,
          messages_ingested, messages_skipped, run_completed_at)
       VALUES ($1, ARRAY[$2], 'success', 5, 0, NOW())
       RETURNING id`,
      [unknownEmail, testMonth],
    )
    unknownRunId = Number(unknownRun.rows[0].id)
    insertedRunIds.push(unknownRunId)
  })

  afterAll(async () => {
    if (insertedRunIds.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.chat_ingestion_runs WHERE id = ANY($1::bigint[])`,
        [insertedRunIds],
      )
    }
    await pool.query(
      `DELETE FROM cpo_connect.member_profiles WHERE email = $1`,
      [adminEmail],
    )
  })

  it('returns runs + corpus totals with numeric ids and ISO latestMessageAt', async () => {
    const req = makeReq()
    const res = makeRes()
    await ingestionRunsHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = bodyOf(res) as {
      runs: Array<{
        id: number
        runStartedAt: string
        runCompletedAt: string | null
        triggeredBy: string
        messagesIngested: number
        messagesSkipped: number
        status: string
      }>
      totalMessages: number
      latestMessageAt: string
    }

    const ourRun = body.runs.find((r) => r.id === adminRunId)
    expect(ourRun).toBeDefined()
    expect(ourRun?.messagesIngested).toBe(42)
    expect(ourRun?.messagesSkipped).toBe(3)
    expect(ourRun?.status).toBe('success')

    // Codex pass 4 IMPORTANT: runs[].id must be numeric, not a bigint
    // string. Clients compare/sort on this field.
    expect(body.runs.length).toBeGreaterThan(0)
    for (const r of body.runs) {
      expect(typeof r.id).toBe('number')
      expect(Number.isInteger(r.id)).toBe(true)
    }

    // Codex pass 4 IMPORTANT: latestMessageAt must be ISO 8601 with a
    // `T` separator so Safari's Date parser accepts it. Postgres' default
    // text format uses a space which Safari rejects. The test corpus
    // has at least one message from the happy-path ingest test run, so
    // latestMessageAt is non-empty here on the shared DB.
    expect(body.latestMessageAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    )
    // And it must be parseable as a valid Date
    expect(Number.isNaN(new Date(body.latestMessageAt).getTime())).toBe(false)

    // Timestamp fields on individual runs should also be ISO-formatted
    // (handler normalizes via toIsoOrEmpty / toIsoOrNull).
    if (ourRun?.runStartedAt) {
      expect(ourRun.runStartedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      )
    }

    expect(typeof body.totalMessages).toBe('number')
    expect(body.totalMessages).toBeGreaterThanOrEqual(0)
  })

  it('resolves triggeredBy to the member_profiles display name when the email matches', async () => {
    const req = makeReq()
    const res = makeRes()
    await ingestionRunsHandler(req, res)

    const body = bodyOf(res) as {
      runs: Array<{ id: number; triggeredBy: string }>
    }
    const run = body.runs.find((r) => r.id === adminRunId)
    expect(run?.triggeredBy).toBe(adminDisplayName)
  })

  it("resolves triggeredBy to 'Ingestion Script' for headless script runs", async () => {
    const req = makeReq()
    const res = makeRes()
    await ingestionRunsHandler(req, res)

    const body = bodyOf(res) as {
      runs: Array<{ id: number; triggeredBy: string }>
    }
    const run = body.runs.find((r) => r.id === scriptRunId)
    expect(run?.triggeredBy).toBe('Ingestion Script')
  })

  it('falls back to the raw email when no member_profile row matches', async () => {
    const req = makeReq()
    const res = makeRes()
    await ingestionRunsHandler(req, res)

    const body = bodyOf(res) as {
      runs: Array<{ id: number; triggeredBy: string }>
    }
    const run = body.runs.find((r) => r.id === unknownRunId)
    expect(run?.triggeredBy).toBe(unknownEmail)
  })
})

// -----------------------------------------------------------------------------
// End-to-end privacy: ingest → ask → toggle opt-out → ask again
//
// This is the test codex pass 3 flagged as MISSING all along. It proves the
// full privacy contract:
//
//   1. Ingest wires authorReconciliation, so chat_messages.author_email is
//      populated from the WhatsApp sender name matched to member_profiles
//   2. Before the member toggles opt-out, their real name appears in source
//      cards
//   3. After they toggle chat_identification_opted_out = true, their name is
//      redacted to 'A member' in every subsequent ask response
//
// Without the fix shipped in this PR, step 1 never happens (author_email
// was never set), the LEFT JOIN on author_email always returned NULL, and
// the opt-out flag was silently ignored. This test would fail on main.
// -----------------------------------------------------------------------------

dbDescribe('end-to-end privacy: ingest → ask → opt-out', () => {
  const memberName = `WETA Privacy Test ${randomUUID()}`
  const memberEmail = `weta-privacy-${randomUUID()}@test.local`
  const askerEmail = `weta-privacy-asker-${randomUUID()}@test.local`
  const testSourceExport = `weta-privacy-test-${randomUUID()}`
  const testMonth = '2998-11'
  const insertedMessageIds: string[] = []

  beforeAll(async () => {
    // Member whose messages are ingested. chat_identification_opted_out
    // starts false (identifiable).
    await pool.query(
      `INSERT INTO cpo_connect.member_profiles (email, name)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name,
         chat_identification_opted_out = false,
         chat_query_logging_opted_out = false`,
      [memberEmail, memberName],
    )

    // Separate asker member for the /ask call (required so trackEvent has
    // a valid asker email). Must NOT match any ingested author name.
    await pool.query(
      `INSERT INTO cpo_connect.member_profiles (email, name)
       VALUES ($1, 'Privacy Test Asker')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
      [askerEmail],
    )
  })

  afterAll(async () => {
    if (insertedMessageIds.length > 0) {
      await pool.query(
        `DELETE FROM cpo_connect.chat_messages WHERE id = ANY($1::bigint[])`,
        [insertedMessageIds],
      )
    }
    await pool.query(
      `DELETE FROM cpo_connect.chat_ingestion_runs
       WHERE $1 = ANY(source_months)`,
      [testMonth],
    )
    await pool.query(
      `DELETE FROM cpo_connect.member_profiles WHERE email IN ($1, $2)`,
      [memberEmail, askerEmail],
    )
  })

  beforeEach(() => {
    mocks.embedQueryMock.mockReset()
    mocks.synthesizeAnswerMock.mockReset()
  })

  it('opt-out flag redacts the member name end-to-end after ingest via reconciliation', async () => {
    // ------------------------------------------------------------
    // Step 1 — INGEST a message authored by `memberName`. The
    // reconcileAuthorEmails pass should match it to `memberEmail`.
    // ------------------------------------------------------------
    const uniqueText = `weta-privacy-message-${randomUUID()}`
    const ingestReq = makeReq({
      body: {
        month: testMonth,
        sourceExports: [testSourceExport],
        messages: [
          {
            channel: 'leadership_culture',
            authorName: memberName,
            messageText: uniqueText,
            sentAt: '2998-11-01T10:00:00.000Z',
            sourceExport: testSourceExport,
            embedding: fixedVector(0.42),
          },
        ],
      },
      user: { id: 's', email: 'script:ingest', name: 'Script' },
    })
    const ingestRes = makeRes()
    await ingestHandler(ingestReq, ingestRes)
    expect(ingestRes.status).toHaveBeenCalledWith(200)

    // Verify chat_messages.author_email was populated from reconciliation
    // — this is the BLOCKER fix from codex pass 3.
    const inserted = await pool.query<{
      id: string
      author_email: string | null
      author_name: string
    }>(
      `SELECT id::text, author_email, author_name FROM cpo_connect.chat_messages
       WHERE message_text = $1`,
      [uniqueText],
    )
    expect(inserted.rows.length).toBe(1)
    expect(inserted.rows[0].author_email).toBe(memberEmail)
    expect(inserted.rows[0].author_name).toBe(memberName)
    insertedMessageIds.push(inserted.rows[0].id)

    // ------------------------------------------------------------
    // Step 2 — ASK while opt-out is FALSE. Real name appears in sources.
    // ------------------------------------------------------------
    await pool.query(
      `UPDATE cpo_connect.member_profiles
         SET chat_identification_opted_out = false
       WHERE email = $1`,
      [memberEmail],
    )

    mocks.embedQueryMock.mockResolvedValueOnce(fixedVector(0.42))
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'The community discussed pricing strategy.',
      model: 'claude-sonnet-4-5',
    })

    const askBeforeReq = makeReq({
      body: { query: 'pricing', channel: 'leadership_culture', limit: 5 },
      user: { id: 's', email: askerEmail, name: 'Asker' },
    })
    const askBeforeRes = makeRes()
    await askHandler(askBeforeReq, askBeforeRes)

    const beforeBody = bodyOf(askBeforeRes) as {
      sources: Array<{
        authorDisplayName: string
        authorOptedOut: boolean
        messageText: string
      }>
    }

    const ourSourceBefore = beforeBody.sources.find(
      (s) => s.messageText === uniqueText,
    )
    expect(ourSourceBefore).toBeDefined()
    // Before opt-out: real name, not redacted
    expect(ourSourceBefore?.authorDisplayName).toBe(memberName)
    expect(ourSourceBefore?.authorOptedOut).toBe(false)

    // ------------------------------------------------------------
    // Step 3 — TOGGLE opt-out to TRUE.
    // ------------------------------------------------------------
    await pool.query(
      `UPDATE cpo_connect.member_profiles
         SET chat_identification_opted_out = true
       WHERE email = $1`,
      [memberEmail],
    )

    // ------------------------------------------------------------
    // Step 4 — ASK AGAIN. The same message must now render as 'A member'.
    // ------------------------------------------------------------
    mocks.embedQueryMock.mockResolvedValueOnce(fixedVector(0.42))
    mocks.synthesizeAnswerMock.mockResolvedValueOnce({
      answer: 'A member discussed pricing strategy.',
      model: 'claude-sonnet-4-5',
    })

    const askAfterReq = makeReq({
      body: { query: 'pricing', channel: 'leadership_culture', limit: 5 },
      user: { id: 's', email: askerEmail, name: 'Asker' },
    })
    const askAfterRes = makeRes()
    await askHandler(askAfterReq, askAfterRes)

    const afterBody = bodyOf(askAfterRes) as {
      sources: Array<{
        authorDisplayName: string
        authorOptedOut: boolean
        messageText: string
      }>
    }

    const ourSourceAfter = afterBody.sources.find(
      (s) => s.messageText === uniqueText,
    )
    expect(ourSourceAfter).toBeDefined()
    // After opt-out: name IS redacted to 'A member' and the flag is set
    expect(ourSourceAfter?.authorDisplayName).toBe('A member')
    expect(ourSourceAfter?.authorOptedOut).toBe(true)
    // Belt-and-suspenders: the real name should not appear anywhere in
    // the sources array of the post-opt-out response.
    const allDisplayNames = afterBody.sources.map((s) => s.authorDisplayName)
    expect(allDisplayNames).not.toContain(memberName)
  })
})
