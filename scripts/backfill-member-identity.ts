#!/usr/bin/env tsx
/**
 * One-off backfill for the member identity resolution spec
 * (docs/superpowers/specs/2026-04-13-cpo-member-identity-resolution.md).
 *
 * Iterates every cpo_connect.chat_messages row where sender_phone IS NULL
 * AND sender_display_name IS NULL, applies resolveAuthor() to the legacy
 * author_name/author_email, and writes the two new columns back to the row.
 *
 * Idempotent — the WHERE filter means re-runs only touch rows that still
 * haven't been resolved.
 *
 * Usage:
 *   npx tsx scripts/backfill-member-identity.ts
 *
 * Flags:
 *   --dry-run   Count rows that would be updated; do not write.
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
import { syncMembersFromSheet } from '../server/services/members.ts'
import { resolveAuthor } from '../server/lib/resolveAuthor.ts'

export interface BackfillOptions {
  dryRun?: boolean
}

export interface BackfillResult {
  processed: number
  updated: number
  unresolved: number
}

export async function backfillMemberIdentity(
  opts: BackfillOptions = {},
): Promise<BackfillResult> {
  const { dryRun = false } = opts

  // Refresh the in-memory directory cache before resolving. If Sheets API
  // is unreachable we still process with whatever cache is loaded — better
  // to backfill the phone column (no directory lookup needed) than bail.
  try {
    await syncMembersFromSheet()
  } catch (err) {
    console.warn(
      `[backfill] syncMembersFromSheet failed; continuing with existing cache: ${(err as Error).message}`,
    )
  }

  const rowsRes = await pool.query<{
    id: string
    author_name: string
    author_email: string | null
  }>(
    `SELECT id::text, author_name, author_email
     FROM cpo_connect.chat_messages
     WHERE sender_phone IS NULL AND sender_display_name IS NULL`,
  )

  const result: BackfillResult = {
    processed: rowsRes.rowCount ?? 0,
    updated: 0,
    unresolved: 0,
  }

  for (const row of rowsRes.rows) {
    const resolved = resolveAuthor(row.author_name, row.author_email)
    if (resolved.senderPhone === null && resolved.senderDisplayName === null) {
      result.unresolved += 1
      continue
    }
    if (!dryRun) {
      await pool.query(
        `UPDATE cpo_connect.chat_messages
         SET sender_phone = $1, sender_display_name = $2
         WHERE id = $3::bigint`,
        [resolved.senderPhone, resolved.senderDisplayName, row.id],
      )
    }
    result.updated += 1
  }

  console.log(
    `[backfill] processed=${result.processed} updated=${result.updated} unresolved=${result.unresolved} dryRun=${dryRun}`,
  )
  return result
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run')
  backfillMemberIdentity({ dryRun })
    .then(async () => {
      await pool.end()
      process.exit(0)
    })
    .catch(async (err) => {
      console.error('[backfill] failed:', (err as Error).message)
      await pool.end()
      process.exit(1)
    })
}
