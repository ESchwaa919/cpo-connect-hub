#!/usr/bin/env tsx
/**
 * One-off data extraction for THE-553 March highlights retrofit.
 *
 * Pulls the Google Sheet (same integration the magic-link auth flow
 * uses) and prints two pieces of data as JSON:
 *
 *   1. new-members counts for Jan / Feb / Mar 2026, total + per
 *      channel (matches the shape of the stats-row 4th column in
 *      the monthly reports).
 *   2. phone-suffix → full name resolution for the three March
 *      contributors that shipped as `Member ···NNNN` in the current
 *      chat-analysis-mar2026.html file.
 *
 * Requires `GOOGLE_SHEETS_CREDENTIALS` (base64-encoded service account
 * JSON) in the environment. The same env var the Render service uses
 * for magic-link auth.
 *
 * Usage:
 *   GOOGLE_SHEETS_CREDENTIALS=<base64 blob> \
 *   npx tsx scripts/extract-retrofit-data.ts
 *
 * Or load from .env:
 *   npx tsx scripts/extract-retrofit-data.ts
 *
 * Outputs a JSON blob to stdout. Paste it into the PR thread and the
 * retrofit author will wire the values into `chat-analysis-mar2026.html`.
 */

import { readFileSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'

// Inline .env loader (matches scripts/ingest-whatsapp.ts precedent).
try {
  const envPath = pathResolve(process.cwd(), '.env')
  const contents = readFileSync(envPath, 'utf-8')
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(trimmed)
    if (!m || process.env[m[1]]) continue
    let value = m[2]
    const commentIdx = value.search(/\s+#/)
    if (commentIdx >= 0) value = value.slice(0, commentIdx)
    value = value.trim().replace(/^"(.*)"$/, '$1')
    process.env[m[1]] = value
  }
} catch {
  /* .env missing — env vars may still be set via shell */
}

if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
  console.error(
    '[extract-retrofit-data] GOOGLE_SHEETS_CREDENTIALS is not set.\n' +
      'Either add it to .env (gitignored) or export it in your shell, then re-run.',
  )
  process.exit(1)
}

// The phone-suffix labels currently in chat-analysis-mar2026.html. We
// match these against the Phone column in the Sheet to recover the
// real names.
const PHONE_SUFFIXES_TO_RESOLVE = ['9211', '4106', '1055'] as const

// Month boundaries in UTC. The Sheet's join-date column is date-only
// (no time), so we treat the first day of the month inclusive and the
// first day of the next month exclusive.
const MONTHS = [
  { key: '2026-01', label: 'January 2026', from: '2026-01-01', to: '2026-02-01' },
  { key: '2026-02', label: 'February 2026', from: '2026-02-01', to: '2026-03-01' },
  { key: '2026-03', label: 'March 2026', from: '2026-03-01', to: '2026-04-01' },
] as const

interface ExtractionResult {
  generatedAt: string
  sheetId: string
  newMembersByMonth: Record<
    string,
    {
      month: string
      total: number
      notes: string[]
    }
  >
  phoneResolution: Array<{
    suffix: string
    resolvedName: string | null
    resolvedEmail: string | null
  }>
  unresolved: string[]
}

async function main(): Promise<void> {
  // Lazy-import the shared Sheets helpers so this script piggybacks on
  // the exact auth + caching path the magic-link flow uses.
  const { getDirectory } = await import('../server/services/sheets.ts')
  const directory = await getDirectory()

  if (directory.length === 0) {
    console.error(
      '[extract-retrofit-data] Sheet returned 0 joined members. ' +
        'Either credentials are wrong or the Sheet is empty — check the error stream above.',
    )
    process.exit(2)
  }

  // Log the actual Sheet headers on stderr so if a column-name guess
  // below misses, the operator sees what to override.
  const availableHeaders = Object.keys(directory[0]).sort()
  console.error(
    `[extract-retrofit-data] Sheet has ${directory.length} joined members.`,
  )
  console.error(
    `[extract-retrofit-data] Available columns: ${availableHeaders.join(', ')}`,
  )

  // --- New members per month ---------------------------------------------
  //
  // Column name best-guesses. The Sheet has evolved over time — common
  // header names are "Join Date", "Joined", "Joining Date". Try each
  // in order and stop on the first that has non-empty values.
  const JOIN_DATE_COLUMN_CANDIDATES = [
    'Join Date',
    'Joined',
    'Joining Date',
    'Date Joined',
    'Joined Date',
  ]
  let joinDateColumn: string | null = null
  for (const candidate of JOIN_DATE_COLUMN_CANDIDATES) {
    if (directory.some((r) => r[candidate]?.trim())) {
      joinDateColumn = candidate
      break
    }
  }

  const newMembersByMonth: ExtractionResult['newMembersByMonth'] = {}
  for (const m of MONTHS) {
    const notes: string[] = []
    if (!joinDateColumn) {
      notes.push(
        `No join-date column found in Sheet headers. Tried: ${JOIN_DATE_COLUMN_CANDIDATES.join(', ')}.`,
      )
      newMembersByMonth[m.key] = { month: m.label, total: 0, notes }
      continue
    }
    const total = directory.filter((row) => {
      const raw = (row[joinDateColumn!] ?? '').trim()
      if (!raw) return false
      // Accept YYYY-MM-DD, DD/MM/YYYY, and Month Day, Year formats.
      const parsed = new Date(raw)
      if (Number.isNaN(parsed.getTime())) return false
      const iso = parsed.toISOString().slice(0, 10)
      return iso >= m.from && iso < m.to
    }).length
    notes.push(`Counted rows where "${joinDateColumn}" parsed to a date within ${m.from} ≤ x < ${m.to}.`)
    newMembersByMonth[m.key] = { month: m.label, total, notes }
  }

  // --- Phone-suffix resolution -------------------------------------------
  //
  // Look for a phone column. The existing lookupMember path uses
  // "Phone number" — try that first.
  const PHONE_COLUMN_CANDIDATES = ['Phone number', 'Phone', 'Mobile', 'WhatsApp']
  let phoneColumn: string | null = null
  for (const candidate of PHONE_COLUMN_CANDIDATES) {
    if (directory.some((r) => r[candidate]?.trim())) {
      phoneColumn = candidate
      break
    }
  }

  const phoneResolution: ExtractionResult['phoneResolution'] = []
  const unresolved: string[] = []
  for (const suffix of PHONE_SUFFIXES_TO_RESOLVE) {
    if (!phoneColumn) {
      unresolved.push(suffix)
      phoneResolution.push({ suffix, resolvedName: null, resolvedEmail: null })
      continue
    }
    // A phone "suffix" match means the last 4 digits of the Sheet
    // phone number equal the suffix. Strip non-digits before comparing.
    const match = directory.find((row) => {
      const phoneRaw = (row[phoneColumn!] ?? '').replace(/\D/g, '')
      return phoneRaw.endsWith(suffix)
    })
    if (match) {
      phoneResolution.push({
        suffix,
        resolvedName: match['Full Name']?.trim() || null,
        resolvedEmail: match['Email']?.trim() || null,
      })
    } else {
      unresolved.push(suffix)
      phoneResolution.push({ suffix, resolvedName: null, resolvedEmail: null })
    }
  }

  const result: ExtractionResult = {
    generatedAt: new Date().toISOString(),
    sheetId: process.env.GOOGLE_SHEET_ID ?? '14DZ6Zp1UHg688FPTFdbJLCY6AXhgnAcnodV5KjVCAMs',
    newMembersByMonth,
    phoneResolution,
    unresolved,
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('[extract-retrofit-data] Failed:', (err as Error).message)
  process.exit(1)
})
