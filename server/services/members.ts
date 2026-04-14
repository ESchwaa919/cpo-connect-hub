import pool from '../db.ts'
import { normalizePhone } from '../lib/phone.ts'
import { fetchSheet1RawRows } from './sheets.ts'

export interface MemberRow {
  phone: string
  displayName: string
  email: string | null
}

export interface SyncResult {
  totalRows: number
  skippedNotJoined: number
  nameBlank: number
  phoneFailed: number
  upserted: number
}

// In-memory cache rebuilt on every syncMembersFromSheet() call. Lookups
// are O(1) on the Map so the ingest pipeline + backfill script don't
// pay a DB round-trip per message. Cache is per-process; server
// restarts or manual admin syncs reload it.
const cacheByPhone = new Map<string, MemberRow>()
const cacheByEmail = new Map<string, MemberRow>()
const cacheByName = new Map<string, MemberRow>()

export async function syncMembersFromSheet(): Promise<SyncResult> {
  const rows = await fetchSheet1RawRows()
  const result: SyncResult = {
    totalRows: rows.length,
    skippedNotJoined: 0,
    nameBlank: 0,
    phoneFailed: 0,
    upserted: 0,
  }

  // Clear the cache BEFORE the pass so a partial failure still
  // produces a consistent view of whatever rows were successfully
  // written.
  cacheByPhone.clear()
  cacheByEmail.clear()
  cacheByName.clear()

  // Dedupe by normalized phone — Postgres bulk INSERT ... ON CONFLICT
  // DO UPDATE rejects the whole statement with "ON CONFLICT DO UPDATE
  // command cannot affect row a second time" if the input contains two
  // rows with the same conflict-target value. The Sheet has duplicates
  // (same phone listed under multiple rows), so dedupe in JS before
  // sending. Last write wins, matching the previous per-row INSERT
  // loop's behavior.
  const dedupedByPhone = new Map<string, MemberRow>()
  for (const row of rows) {
    const status = (row['Status'] ?? '').trim().toLowerCase()
    if (status !== 'joined') {
      result.skippedNotJoined += 1
      continue
    }

    const name = (row['Full Name'] ?? '').trim()
    if (!name) {
      result.nameBlank += 1
      continue
    }

    const rawPhone = row['Phone number'] ?? ''
    const phone = normalizePhone(rawPhone)
    if (!phone) {
      result.phoneFailed += 1
      console.warn(
        `[members-sync] phone normalization failed for ${name} (raw="${rawPhone}")`,
      )
      continue
    }

    const email = (row['Email'] ?? '').trim() || null
    dedupedByPhone.set(phone, { phone, displayName: name, email })
  }
  const valid = Array.from(dedupedByPhone.values())

  // Single bulk upsert via unnest() — one round-trip instead of N.
  if (valid.length > 0) {
    const phones = valid.map((m) => m.phone)
    const names = valid.map((m) => m.displayName)
    const emails = valid.map((m) => m.email)
    await pool.query(
      `INSERT INTO cpo_connect.members (phone, display_name, email, updated_at)
       SELECT phone, display_name, email, NOW()
       FROM unnest($1::text[], $2::text[], $3::text[])
         AS t(phone, display_name, email)
       ON CONFLICT (phone) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             email = EXCLUDED.email,
             updated_at = NOW()`,
      [phones, names, emails],
    )
  }

  for (const member of valid) {
    cacheByPhone.set(member.phone, member)
    if (member.email) cacheByEmail.set(member.email.toLowerCase(), member)
    cacheByName.set(member.displayName.toLowerCase(), member)
    result.upserted += 1
  }

  console.log(
    `[members-sync] total=${result.totalRows} upserted=${result.upserted} skippedNotJoined=${result.skippedNotJoined} nameBlank=${result.nameBlank} phoneFailed=${result.phoneFailed}`,
  )
  return result
}

export function getMemberByPhone(phone: string): MemberRow | null {
  return cacheByPhone.get(phone) ?? null
}

export function getMemberByEmail(email: string): MemberRow | null {
  if (!email) return null
  return cacheByEmail.get(email.toLowerCase()) ?? null
}

export function getMemberByNameCaseInsensitive(
  name: string,
): MemberRow | null {
  if (!name) return null
  return cacheByName.get(name.toLowerCase()) ?? null
}
