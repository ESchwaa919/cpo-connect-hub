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

    await pool.query(
      `INSERT INTO cpo_connect.members (phone, display_name, email, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (phone) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             email = EXCLUDED.email,
             updated_at = NOW()`,
      [phone, name, email],
    )

    const member: MemberRow = { phone, displayName: name, email }
    cacheByPhone.set(phone, member)
    if (email) cacheByEmail.set(email.toLowerCase(), member)
    cacheByName.set(name.toLowerCase(), member)
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
