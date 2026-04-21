// Dedupe directory rows by lowercased email. Motivated by Tania Shedley's
// double appearance in the member directory: Sheet1 contained two rows with
// the same email for a re-invited member, and getDirectory() was returning
// both as distinct members. Keeping the row with the most recent Date
// (DD/MM/YYYY sheet format, the "join" date) preserves the freshest
// profile-adjacent data (phone format, cohort tag).
//
// Rows without an email are passed through unchanged — we never collapse on
// a blank key.

type Row = Record<string, string | undefined>

function parseSheetDate(raw: string | undefined): number {
  if (!raw) return 0
  const parts = raw.split('/')
  if (parts.length === 3) {
    const d = new Date(
      Number(parts[2]),
      Number(parts[1]) - 1,
      Number(parts[0]),
    )
    const ts = d.getTime()
    if (!Number.isNaN(ts)) return ts
  }
  const iso = new Date(raw).getTime()
  return Number.isNaN(iso) ? 0 : iso
}

export function dedupeDirectoryByEmail<T extends Row>(rows: T[]): T[] {
  const byEmail = new Map<string, T>()
  for (const row of rows) {
    const key = row['Email']?.trim().toLowerCase()
    if (!key) continue
    const existing = byEmail.get(key)
    if (
      !existing ||
      parseSheetDate(row['Date']) > parseSheetDate(existing['Date'])
    ) {
      byEmail.set(key, row)
    }
  }

  const out: T[] = []
  for (const row of rows) {
    const key = row['Email']?.trim().toLowerCase()
    if (!key) {
      out.push(row)
      continue
    }
    if (byEmail.get(key) === row) out.push(row)
  }
  return out
}
