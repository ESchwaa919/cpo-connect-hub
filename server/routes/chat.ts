import express, { Router, type Request, type Response } from 'express'
import { createHash } from 'node:crypto'
import pool from '../db.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/requireAdmin.ts'
import { requireIngestAuth } from '../middleware/requireIngestAuth.ts'
import { chatAskRateLimit } from '../services/chat-rate-limit.ts'
import {
  embedQuery,
  EmbeddingUnavailableError,
} from '../services/chatEmbedding.ts'
import {
  synthesizeAnswer,
  SynthesisUnavailableError,
  type SynthesisSource,
} from '../services/chatSynthesis.ts'
import {
  matchAuthor,
  type ProfileMatchCandidate,
} from '../services/authorReconciliation.ts'
import { trackEvent, AnalyticsEvent } from '../services/analytics.ts'
import { syncMembersFromSheet } from '../services/members.ts'
import {
  sanitizePhone,
  sanitizeRawAuthorString,
  looksLikeRawPhone,
} from '../lib/phone.ts'

/** Stable short codes for WETA route responses. Used by the frontend to
 *  discriminate error states without string-matching the message field. */
export const ChatErrorCode = {
  BAD_QUERY: 'bad_query',
  BAD_MONTH: 'bad_month',
  EMBEDDING_UNAVAILABLE: 'embedding_unavailable',
  SYNTHESIS_UNAVAILABLE: 'synthesis_unavailable',
} as const

/** Cosine-similarity floor applied to pgvector search results. Rows
 *  below this are dropped before they reach Claude, so low-quality
 *  matches don't waste input context or bias the answer. Default 0.4
 *  is deliberately lower than the 0.65 attempt from PR #33 (which
 *  over-filtered) — this just drops the genuinely noisy tail. Read
 *  once at module load; rotating requires a process restart. */
const CHAT_SEARCH_MIN_SIMILARITY: number = (() => {
  const raw = process.env.CHAT_SEARCH_MIN_SIMILARITY
  if (raw === undefined || raw === '') return 0.4
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    console.warn(
      `[chat/ask] invalid CHAT_SEARCH_MIN_SIMILARITY=${raw}, falling back to 0.4`,
    )
    return 0.4
  }
  return n
})()

/** WETA spec (failure-mode contract for /api/chat/ask and peers) uses
 *  `{ error: 'internal' }` as the 500 response shape — frontend discriminates
 *  on the `error` field value. */
function sendServerError(res: Response, route: string, err: unknown): void {
  console.error(`${route} error:`, (err as Error).message)
  res.status(500).json({ error: 'internal' })
}

function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

function isValidDateString(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const parsed = Date.parse(s)
  return !Number.isNaN(parsed)
}

// ---------------------------------------------------------------------------
// POST /api/chat/ask — synthesized answer with cited sources
// ---------------------------------------------------------------------------

export interface AskSourceDBRow {
  id: string
  channel: string
  author_name: string
  author_email: string | null
  message_text: string
  sent_at: string
  sender_phone: string | null
  sender_display_name: string | null
  live_member_name: string | null
  opted_out: boolean | null
  similarity: number
}

/** Display-time resolution chain for a chat message's author. Matches
 *  the order documented in the identity-resolution spec: live members
 *  row → ingest-time frozen snapshot → sanitized phone → sanitized
 *  legacy author_name. Never returns a raw phone number — a final
 *  belt-and-braces guard masks any branch output that still looks like
 *  one (e.g. a historical members.display_name row that was populated
 *  with the phone string before syncMembersFromSheet learned to write
 *  a placeholder). */
export function pickAuthorDisplay(row: AskSourceDBRow): string {
  const resolved = resolveAuthorName(row)
  if (looksLikeRawPhone(resolved)) {
    return sanitizeRawAuthorString(resolved)
  }
  return resolved
}

function resolveAuthorName(row: AskSourceDBRow): string {
  if (row.live_member_name) return row.live_member_name
  if (row.sender_display_name && !looksLikeRawPhone(row.sender_display_name)) {
    return row.sender_display_name
  }
  if (row.sender_phone) return sanitizePhone(row.sender_phone)
  return sanitizeRawAuthorString(row.author_name)
}

export async function askHandler(req: Request, res: Response): Promise<void> {
  const startedAt = Date.now()
  const email = req.user!.email.toLowerCase()

  const rawQuery = req.body?.query
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : ''
  if (!query || query.length > 500) {
    res.status(400).json({ error: ChatErrorCode.BAD_QUERY })
    return
  }

  // Validate date filters up front so malformed strings return a 400
  // bad_query instead of bubbling up as a Postgres `invalid input syntax
  // for type timestamptz` inside the 500 path. Only strings are accepted;
  // undefined is allowed (filter omitted).
  const rawDateFrom = req.body?.dateFrom
  const rawDateTo = req.body?.dateTo
  if (rawDateFrom !== undefined && !isValidDateString(rawDateFrom)) {
    res.status(400).json({ error: ChatErrorCode.BAD_QUERY })
    return
  }
  if (rawDateTo !== undefined && !isValidDateString(rawDateTo)) {
    res.status(400).json({ error: ChatErrorCode.BAD_QUERY })
    return
  }

  const limit = Math.min(
    Math.max(typeof req.body?.limit === 'number' ? req.body.limit : 12, 1),
    30,
  )
  // Accept either `channels: string[]` (preferred, multi-select) or the
  // legacy `channel: string` (back-compat with pre-redesign clients).
  // null = all channels (no filter).
  const channels: string[] | null = (() => {
    if (Array.isArray(req.body?.channels)) {
      const arr = (req.body.channels as unknown[]).filter(
        (c): c is string => typeof c === 'string' && c.length > 0,
      )
      return arr.length > 0 ? arr : null
    }
    if (typeof req.body?.channel === 'string' && req.body.channel.length > 0) {
      return [req.body.channel]
    }
    return null
  })()
  const dateFrom = typeof rawDateFrom === 'string' ? rawDateFrom : null
  const dateTo = typeof rawDateTo === 'string' ? rawDateTo : null

  // Fire-and-forget privacy-aware event logging. Never awaited — must not
  // block the hot path. Errors are logged but not surfaced to the caller.
  pool
    .query<{ opted_out: boolean | null }>(
      `SELECT chat_query_logging_opted_out AS opted_out
       FROM cpo_connect.member_profiles
       WHERE email = $1`,
      [email],
    )
    .then((r) => {
      const optedOut = r.rows[0]?.opted_out === true
      if (optedOut) {
        trackEvent(AnalyticsEvent.CHAT_QUERY_REDACTED, email, {
          char_count: query.length,
          channels,
          limit,
        })
      } else {
        trackEvent(AnalyticsEvent.CHAT_QUERY, email, {
          query,
          channels,
          limit,
        })
      }
    })
    .catch((err) => {
      console.error(
        '[chat/ask] opt-out lookup failed:',
        (err as Error).message,
      )
    })

  try {
    let embedding: number[]
    try {
      embedding = await embedQuery(query)
    } catch (err) {
      if (err instanceof EmbeddingUnavailableError) {
        res.setHeader('Retry-After', '30')
        res.status(503).json({
          error: ChatErrorCode.EMBEDDING_UNAVAILABLE,
          retryAfterSec: 30,
        })
        return
      }
      throw err
    }

    const result = await pool.query<AskSourceDBRow>(
      `SELECT
        cm.id::text AS id,
        cm.channel,
        cm.author_name,
        cm.author_email,
        cm.message_text,
        cm.sent_at,
        cm.sender_phone,
        cm.sender_display_name,
        mem.display_name AS live_member_name,
        mp.chat_identification_opted_out AS opted_out,
        1 - (cm.embedding <=> $1::vector) AS similarity
      FROM cpo_connect.chat_messages cm
      LEFT JOIN cpo_connect.members mem
        ON mem.phone = cm.sender_phone
      LEFT JOIN cpo_connect.member_profiles mp
        ON cm.author_email = mp.email
      WHERE cm.embedding IS NOT NULL
        AND (1 - (cm.embedding <=> $1::vector)) > $6
        AND ($2::text[] IS NULL OR cm.channel = ANY($2::text[]))
        AND ($3::timestamptz IS NULL OR cm.sent_at >= $3)
        AND ($4::timestamptz IS NULL OR cm.sent_at <= $4)
      ORDER BY cm.embedding <=> $1::vector
      LIMIT $5`,
      [
        toVectorLiteral(embedding),
        channels,
        dateFrom,
        dateTo,
        limit,
        CHAT_SEARCH_MIN_SIMILARITY,
      ],
    )

    if (result.rows.length === 0) {
      res.status(200).json({
        answer: null,
        sources: [],
        message: 'No relevant chat history found for this question',
        queryMs: Date.now() - startedAt,
        model: null,
      })
      return
    }

    const sources: Array<
      SynthesisSource & { authorOptedOut: boolean; similarity: number }
    > = result.rows.map((row, i) => {
      const optedOut = row.opted_out === true
      const resolvedName = pickAuthorDisplay(row)
      return {
        id: String(i + 1),
        channel: row.channel,
        authorDisplayName: optedOut ? 'A member' : resolvedName,
        authorOptedOut: optedOut,
        sentAt: new Date(row.sent_at).toISOString(),
        messageText: row.message_text,
        similarity: Number(row.similarity),
      }
    })

    let answer: string
    let model: string
    try {
      const out = await synthesizeAnswer({ query, sources })
      answer = out.answer
      model = out.model
    } catch (err) {
      if (err instanceof SynthesisUnavailableError) {
        res.status(503).json({ error: ChatErrorCode.SYNTHESIS_UNAVAILABLE })
        return
      }
      throw err
    }

    const queryMs = Date.now() - startedAt

    // Persist the query + answer so we can iterate on prompt/cutoff/
    // embedding quality post-launch. Failures here MUST NOT break the
    // user response — catch + return null → frontend renders without
    // the feedback row.
    const queryLogId = await pool
      .query<{ id: string }>(
        `INSERT INTO cpo_connect.chat_query_log
           (user_id, query_text, answer_text, source_count, query_ms, model, channels)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id::text`,
        [email, query, answer, sources.length, queryMs, model, channels],
      )
      .then((r) => r.rows[0]?.id ?? null)
      .catch((err) => {
        console.error(
          '[chat/ask] query log insert failed:',
          (err as Error).message,
        )
        return null
      })

    res.status(200).json({
      answer,
      sources,
      queryMs,
      model,
      queryLogId,
    })
  } catch (err) {
    sendServerError(res, 'POST /api/chat/ask', err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/chat/feedback — thumbs up/down on a query log row
// ---------------------------------------------------------------------------

interface FeedbackBody {
  queryLogId?: unknown
  rating?: unknown
}

/** Accept only a digit-only string of reasonable length. Validating
 *  BEFORE the SQL binding is critical — a malformed value like "foo"
 *  would otherwise reach Postgres, trigger `invalid input syntax for
 *  type bigint`, and bubble out as a 500 instead of the correct 400. */
function parseQueryLogId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length === 0 || raw.length > 20) return null
  if (!/^\d+$/.test(raw)) return null
  return raw
}

export async function feedbackHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const email = req.user!.email.toLowerCase()
    const body = (req.body ?? {}) as FeedbackBody
    const queryLogId = parseQueryLogId(body.queryLogId)
    const rating =
      body.rating === 'thumbs_up' || body.rating === 'thumbs_down'
        ? body.rating
        : null
    if (!queryLogId || !rating) {
      res.status(400).json({ error: ChatErrorCode.BAD_QUERY })
      return
    }

    // Ownership check + insert in one statement. The INSERT ... SELECT
    // only produces a row when user_id matches the caller, so a
    // rowCount of 0 covers both "no such log" and "not yours" — we
    // return the same 404 in both cases to avoid leaking existence.
    const result = await pool.query(
      `INSERT INTO cpo_connect.chat_query_feedback (query_log_id, rating)
       SELECT id, $2
       FROM cpo_connect.chat_query_log
       WHERE id = $1::bigint AND user_id = $3`,
      [queryLogId, rating, email],
    )
    if ((result.rowCount ?? 0) === 0) {
      res.status(404).json({ error: 'query_log_not_found' })
      return
    }
    res.status(204).end()
  } catch (err) {
    sendServerError(res, 'POST /api/chat/feedback', err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/chat/query-log.csv — admin-only CSV export
// ---------------------------------------------------------------------------

interface QueryLogCsvRow {
  id: string
  user_id_display: string
  query_text: string
  answer_text: string | null
  source_count: number
  query_ms: number | null
  model: string | null
  created_at: string
  rating: string | null
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function queryLogCsvHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    // LEFT JOIN member_profiles → we can redact the user_id column
    // for opted-out askers per Cluster F. COALESCE(...false) makes
    // opt-out a hard default on join miss (safer than leaking on a
    // row-missing edge case).
    const result = await pool.query<QueryLogCsvRow>(
      `SELECT
         l.id::text AS id,
         CASE
           WHEN COALESCE(mp.chat_identification_opted_out, false) = true
             THEN 'A member'
           ELSE l.user_id
         END AS user_id_display,
         l.query_text,
         l.answer_text,
         l.source_count,
         l.query_ms,
         l.model,
         l.created_at::text AS created_at,
         f.rating
       FROM cpo_connect.chat_query_log l
       LEFT JOIN cpo_connect.member_profiles mp ON mp.email = l.user_id
       LEFT JOIN cpo_connect.chat_query_feedback f ON f.query_log_id = l.id
       ORDER BY l.created_at DESC
       LIMIT 5000`,
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="chat-query-log.csv"',
    )
    res.write(
      'id,user_id,query_text,answer_text,source_count,query_ms,model,created_at,rating\n',
    )
    for (const row of result.rows) {
      res.write(
        [
          row.id,
          csvEscape(row.user_id_display),
          csvEscape(row.query_text),
          csvEscape(row.answer_text ?? ''),
          row.source_count,
          row.query_ms ?? '',
          csvEscape(row.model ?? ''),
          row.created_at,
          row.rating ?? '',
        ].join(',') + '\n',
      )
    }
    res.end()
  } catch (err) {
    sendServerError(res, 'GET /api/admin/chat/query-log.csv', err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/chat/prompt-tiles — current + evergreen tile lists
// ---------------------------------------------------------------------------

interface PromptTileDBRow {
  id: string
  scope: string
  title: string
  query: string
  sort_order: number
}

export async function promptTilesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const channel = typeof req.query.channel === 'string' ? req.query.channel : null
    // When `channel` is omitted, return ALL tiles (cross-channel +
    // every channel's specific tiles). When a channel is supplied, return
    // cross-channel tiles + just that channel's specific tiles.
    const result = await pool.query<PromptTileDBRow>(
      `SELECT id::text, scope, title, query, sort_order
       FROM cpo_connect.chat_prompt_tiles
       WHERE $1::text IS NULL OR channel IS NULL OR channel = $1
       ORDER BY scope, sort_order, id`,
      [channel],
    )

    const current = result.rows
      .filter((r) => r.scope === 'current')
      .map((r) => ({ id: r.id, title: r.title, query: r.query }))
    const evergreen = result.rows
      .filter((r) => r.scope === 'evergreen')
      .map((r) => ({ id: r.id, title: r.title, query: r.query }))

    res.status(200).json({ current, evergreen })
  } catch (err) {
    sendServerError(res, 'GET /api/chat/prompt-tiles', err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/chat/ingest — bulk ingest messages + refresh current tiles
// ---------------------------------------------------------------------------

interface IngestMessageBody {
  channel: string
  authorName: string
  messageText: string
  sentAt: string
  sourceExport: string
  embedding: number[]
  // Optional on the wire so older CLI builds that don't yet emit
  // the identity fields still POST successfully (back-compat).
  senderPhone?: string | null
  senderDisplayName?: string | null
}

interface IngestPromptTileBody {
  scope: 'current' | 'evergreen'
  channel?: string
  title: string
  query: string
}

const MESSAGE_BATCH_SIZE = 100

/** In-memory shape used by the batch insert. Carries the reconciled
 *  `authorEmail` (or null) alongside the raw IngestMessageBody so the
 *  insert SQL can persist both columns. */
interface ReconciledIngestMessage extends IngestMessageBody {
  authorEmail: string | null
}

function contentHash(m: IngestMessageBody): string {
  return createHash('sha256')
    .update(`${m.channel}|${m.authorName}|${m.sentAt}|${m.messageText}`)
    .digest('hex')
}

function isValidIngestMessage(m: IngestMessageBody): boolean {
  if (!Array.isArray(m.embedding) || m.embedding.length !== 768) return false
  if (typeof m.sourceExport !== 'string' || m.sourceExport.length === 0) return false
  if (typeof m.channel !== 'string' || m.channel.length === 0) return false
  if (typeof m.sentAt !== 'string') return false
  // Reject unparseable timestamps so Postgres doesn't blow up the whole
  // run with `invalid input syntax for type timestamptz`. Counted in
  // skipped instead.
  if (Number.isNaN(new Date(m.sentAt).getTime())) return false
  return true
}

async function batchInsertMessages(
  messages: ReconciledIngestMessage[],
): Promise<number> {
  if (messages.length === 0) return 0

  let totalInserted = 0
  for (let i = 0; i < messages.length; i += MESSAGE_BATCH_SIZE) {
    const chunk = messages.slice(i, i + MESSAGE_BATCH_SIZE)
    const values: string[] = []
    const params: unknown[] = []
    for (const m of chunk) {
      const base = params.length
      values.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}::vector, $${base + 9}, $${base + 10})`,
      )
      params.push(
        m.channel,
        m.authorName,
        m.authorEmail,
        m.messageText,
        m.sentAt,
        m.sourceExport,
        contentHash(m),
        toVectorLiteral(m.embedding),
        m.senderPhone ?? null,
        m.senderDisplayName ?? null,
      )
    }
    const result = await pool.query(
      `INSERT INTO cpo_connect.chat_messages
         (channel, author_name, author_email, message_text, sent_at, source_export, content_hash, embedding, sender_phone, sender_display_name)
       VALUES ${values.join(',')}
       ON CONFLICT (content_hash) DO NOTHING`,
      params,
    )
    totalInserted += result.rowCount ?? 0
  }
  return totalInserted
}

/** Reads the member directory ONCE per ingest run and resolves each
 *  message's `authorName` to an email (or null). Phone-number senders,
 *  guests, and ambiguous names all resolve to null — `chat_messages.author_name`
 *  still holds the raw WhatsApp name so the UI can show something. */
async function reconcileAuthorEmails(
  messages: IngestMessageBody[],
): Promise<ReconciledIngestMessage[]> {
  if (messages.length === 0) return []

  const directoryResult = await pool.query<ProfileMatchCandidate>(
    `SELECT email, name FROM cpo_connect.member_profiles
     WHERE email IS NOT NULL AND name IS NOT NULL`,
  )
  const directory = directoryResult.rows

  return messages.map((m) => ({
    ...m,
    authorEmail: matchAuthor(m.authorName, directory),
  }))
}

/** Atomic replace of scope='current' prompt tiles. DELETE + INSERT run
 *  inside a single transaction so a mid-loop failure rolls back and the
 *  existing current tiles stay intact. */
async function refreshCurrentPromptTiles(
  tiles: IngestPromptTileBody[],
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `DELETE FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`,
    )
    if (tiles.length > 0) {
      const values: string[] = []
      const params: unknown[] = []
      tiles.forEach((t, i) => {
        const base = params.length
        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
        )
        params.push(t.scope, t.channel ?? null, t.title, t.query, i)
      })
      await client.query(
        `INSERT INTO cpo_connect.chat_prompt_tiles
           (scope, channel, title, query, sort_order)
         VALUES ${values.join(',')}`,
        params,
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch((rollbackErr) => {
      console.error(
        '[chat/ingest] ROLLBACK failed after transaction error:',
        (rollbackErr as Error).message,
      )
    })
    throw err
  } finally {
    client.release()
  }
}

export async function ingestHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const startedAt = Date.now()
  let runId: number | null = null

  try {
    const month = typeof req.body?.month === 'string' ? req.body.month : ''
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: ChatErrorCode.BAD_MONTH })
      return
    }

    const messages = Array.isArray(req.body?.messages)
      ? (req.body.messages as IngestMessageBody[])
      : []

    // Detect presence of the promptTiles field vs. absence. An empty array
    // is a legitimate "clear all current tiles" signal; field omitted is
    // "don't touch tiles at all" (back-compat for runs that don't manage
    // tiles). `'promptTiles' in req.body` distinguishes the two cases
    // where `.length > 0` would conflate them.
    const promptTilesProvided =
      req.body != null &&
      typeof req.body === 'object' &&
      'promptTiles' in req.body &&
      Array.isArray(req.body.promptTiles)
    const promptTiles: IngestPromptTileBody[] = promptTilesProvided
      ? (req.body.promptTiles as IngestPromptTileBody[])
      : []

    const runResult = await pool.query<{ id: string }>(
      `INSERT INTO cpo_connect.chat_ingestion_runs
         (triggered_by_email, source_months, status)
       VALUES ($1, $2, 'running')
       RETURNING id`,
      [req.user!.email, [month]],
    )
    // pg returns bigint as string by default; coerce to Number for the
    // public API shape (spec requires runId to be numeric).
    runId = Number(runResult.rows[0].id)

    const validMessages = messages.filter(isValidIngestMessage)
    // Reconcile WhatsApp sender names to member_profiles emails in one
    // directory lookup so the identification opt-out flag actually
    // gets honored at query time. Phone-number senders and unknown
    // names return null and keep only the raw `author_name`.
    const reconciled = await reconcileAuthorEmails(validMessages)
    const ingested = await batchInsertMessages(reconciled)
    // skipped = validation drops + dedup drops. Because ingested counts
    // only actually-inserted rows, the remainder of messages.length is
    // either a validation miss or a content_hash conflict. Reporting
    // one aggregate count matches the spec's ingest response shape.
    const skipped = messages.length - ingested

    if (promptTilesProvided) {
      await refreshCurrentPromptTiles(promptTiles)
    }

    await pool.query(
      `UPDATE cpo_connect.chat_ingestion_runs
         SET status = 'success',
             run_completed_at = NOW(),
             messages_ingested = $2,
             messages_skipped = $3
       WHERE id = $1`,
      [runId, ingested, skipped],
    )

    res.status(200).json({
      runId,
      ingested,
      skipped,
      durationMs: Date.now() - startedAt,
    })
  } catch (err) {
    console.error('POST /api/admin/chat/ingest error:', (err as Error).message)
    if (runId !== null) {
      await pool
        .query(
          `UPDATE cpo_connect.chat_ingestion_runs
             SET status = 'failed',
                 run_completed_at = NOW(),
                 error_message = $2
           WHERE id = $1`,
          [runId, (err as Error).message],
        )
        .catch(() => {})
    }
    res.status(500).json({ error: 'internal' })
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/chat/ingestion-runs — history + corpus size
// ---------------------------------------------------------------------------

interface IngestionRunDBRow {
  // pg-node returns BIGSERIAL columns as strings because the full bigint
  // range doesn't fit in a JS number. The handler coerces with Number()
  // before responding (the spec's runId field is numeric).
  id: string
  // timestamptz columns come back as JS Date objects via pg's default type
  // parser — they're serialized to ISO strings below.
  run_started_at: Date
  run_completed_at: Date | null
  triggered_by: string
  source_months: string[] | null
  messages_ingested: number
  messages_skipped: number
  status: string
  error_message: string | null
}

function toIsoOrEmpty(v: Date | null | undefined): string {
  return v instanceof Date ? v.toISOString() : ''
}

function toIsoOrNull(v: Date | null | undefined): string | null {
  return v instanceof Date ? v.toISOString() : null
}

export async function ingestionRunsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    // Combined aggregate so we only make two round trips instead of three.
    //
    // `triggered_by` is resolved via LEFT JOIN on member_profiles so admin
    // runs show the operator's display name. Headless script runs use
    // the synthetic email `script:ingest` which maps to 'Ingestion Script'.
    // Everything else (unknown emails, legacy rows) falls back to the raw
    // email for debuggability.
    const [runsResult, aggResult] = await Promise.all([
      pool.query<IngestionRunDBRow>(
        `SELECT
           r.id,
           r.run_started_at,
           r.run_completed_at,
           COALESCE(
             mp.name,
             CASE
               WHEN r.triggered_by_email = 'script:ingest' THEN 'Ingestion Script'
               ELSE r.triggered_by_email
             END,
             ''
           ) AS triggered_by,
           r.source_months,
           r.messages_ingested,
           r.messages_skipped,
           r.status,
           r.error_message
         FROM cpo_connect.chat_ingestion_runs r
         LEFT JOIN cpo_connect.member_profiles mp
           ON mp.email = r.triggered_by_email
         ORDER BY r.run_started_at DESC
         LIMIT 50`,
      ),
      pool.query<{ count: string; latest: Date | null }>(
        `SELECT COUNT(*)::text AS count, MAX(sent_at) AS latest
         FROM cpo_connect.chat_messages`,
      ),
    ])

    res.status(200).json({
      runs: runsResult.rows.map((r) => ({
        // Spec calls for numeric run ids; pg returns bigint as string.
        id: Number(r.id),
        runStartedAt: toIsoOrEmpty(r.run_started_at),
        runCompletedAt: toIsoOrNull(r.run_completed_at),
        triggeredBy: r.triggered_by,
        sourceMonths: r.source_months ?? [],
        messagesIngested: r.messages_ingested,
        messagesSkipped: r.messages_skipped,
        status: r.status as 'running' | 'success' | 'failed',
        errorMessage: r.error_message,
      })),
      totalMessages: Number(aggResult.rows[0].count),
      // ISO 8601 with a `T` separator so Safari's Date parser accepts it.
      // Postgres' default text form uses a space which Safari rejects —
      // fixed by letting pg return a Date and formatting here.
      latestMessageAt: toIsoOrEmpty(aggResult.rows[0]?.latest),
    })
  } catch (err) {
    sendServerError(res, 'GET /api/admin/chat/ingestion-runs', err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/chat/sync-members — admin-triggered Sheets resync
// ---------------------------------------------------------------------------

export async function syncMembersHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const result = await syncMembersFromSheet()
    res.status(200).json(result)
  } catch (err) {
    sendServerError(res, 'POST /api/admin/chat/sync-members', err)
  }
}

// ---------------------------------------------------------------------------
// Routers
// ---------------------------------------------------------------------------

// Member-facing routes mounted under /api/chat
export const chatMemberRouter = Router()
chatMemberRouter.post('/ask', requireAuth, chatAskRateLimit, askHandler)
chatMemberRouter.get('/prompt-tiles', requireAuth, promptTilesHandler)
chatMemberRouter.post('/feedback', requireAuth, feedbackHandler)

// Admin routes mounted under /api/admin/chat. Split from the member router
// so POST /ingest can mount its own 50MB body parser AFTER requireIngestAuth
// without also exposing the routes at the default ~100KB limit under
// /api/chat. The body parser runs post-auth so unauthenticated requests
// can't force pre-auth buffering of large bodies.
const ingestJsonParser = express.json({ limit: '50mb' })

export const chatAdminRouter = Router()
chatAdminRouter.post(
  '/ingest',
  requireIngestAuth,
  ingestJsonParser,
  ingestHandler,
)
chatAdminRouter.get(
  '/ingestion-runs',
  requireAuth,
  requireAdmin,
  ingestionRunsHandler,
)
chatAdminRouter.post(
  '/sync-members',
  requireAuth,
  requireAdmin,
  syncMembersHandler,
)
chatAdminRouter.get(
  '/query-log.csv',
  requireAuth,
  requireAdmin,
  queryLogCsvHandler,
)
