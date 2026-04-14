#!/usr/bin/env tsx
/**
 * One-off backfill: populate cpo_connect.chat_messages.embedding_local
 * for all rows that don't yet have a 384-dim local vector.
 *
 * Run AFTER PR 2 deploys (which adds the column) and BEFORE flipping
 * USE_LOCAL_EMBEDDINGS=true on Render. While the flag is false, the
 * askHandler still uses the legacy Gemini embedding column, so this
 * script can run in parallel with live traffic without affecting
 * search results.
 *
 * Idempotent — the WHERE filter only picks up rows where the column
 * is still NULL. Re-runs are a no-op once the corpus is fully
 * backfilled.
 *
 * Usage:
 *   npx tsx scripts/backfill-local-embeddings.ts
 *
 * Erik runs this locally against prod (requires DATABASE_URL in .env
 * and the local IP in Render Postgres' allow list).
 */
import { readFileSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'

try {
  const envPath = pathResolve(process.cwd(), '.env')
  const contents = readFileSync(envPath, 'utf-8')
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(trimmed)
    if (!m || process.env[m[1]]) continue
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
} catch {
  /* .env missing — process.env used as-is */
}

import pool from '../server/db.ts'
import { embedQueryLocal } from '../server/lib/embed.ts'

const BATCH = 50

async function main(): Promise<void> {
  console.log('[backfill] starting local embedding backfill')
  const total = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM cpo_connect.chat_messages WHERE embedding_local IS NULL`,
  )
  const totalCount = Number(total.rows[0].count)
  console.log(`[backfill] ${totalCount} rows pending`)
  if (totalCount === 0) {
    console.log('[backfill] nothing to do, exiting')
    await pool.end()
    return
  }

  let processed = 0
  let failed = 0
  // Cursor-based loop: filter on `id > $cursor` instead of just
  // `embedding_local IS NULL`. This guarantees the loop ALWAYS makes
  // forward progress even when individual rows fail permanently
  // (oversize message, tokenizer OOM, etc.) — the failed row stays
  // NULL but the cursor advances past it so the next batch picks
  // up unseen rows. Without this, a single persistently-failing
  // row would re-select itself every iteration forever.
  let cursor = '0'
  while (true) {
    const rows = await pool.query<{ id: string; message_text: string }>(
      `SELECT id::text, message_text FROM cpo_connect.chat_messages
       WHERE embedding_local IS NULL
         AND id > $1::bigint
       ORDER BY id ASC
       LIMIT $2`,
      [cursor, BATCH],
    )
    if (rows.rows.length === 0) break

    for (const row of rows.rows) {
      try {
        const vec = await embedQueryLocal(row.message_text)
        await pool.query(
          `UPDATE cpo_connect.chat_messages SET embedding_local = $1::vector WHERE id = $2::bigint`,
          [`[${vec.join(',')}]`, row.id],
        )
        processed += 1
      } catch (err) {
        failed += 1
        console.error(
          `[backfill] row ${row.id} failed:`,
          (err as Error).message,
        )
      }
    }
    // Advance past the highest-id row in this batch regardless of
    // per-row success. Failed rows stay NULL but never re-enter the
    // selection window.
    cursor = rows.rows[rows.rows.length - 1].id
    console.log(
      `[backfill] processed=${processed} failed=${failed} cursor=${cursor} (of ${totalCount})`,
    )
  }
  console.log(
    `[backfill] done — total processed=${processed} failed=${failed}`,
  )
  await pool.end()
}

main().catch((err) => {
  console.error('[backfill] fatal:', (err as Error).message)
  process.exit(1)
})
