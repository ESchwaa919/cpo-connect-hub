import { describe, it, expect } from 'vitest'
import { dedupeDirectoryByEmail } from '../../server/routes/directory-dedupe'

describe('dedupeDirectoryByEmail', () => {
  it('returns input unchanged when there are no duplicate emails', () => {
    const rows = [
      { Email: 'a@example.com', 'Full Name': 'Alice' },
      { Email: 'b@example.com', 'Full Name': 'Bob' },
    ]
    expect(dedupeDirectoryByEmail(rows)).toEqual(rows)
  })

  it('keeps only one row per email (case-insensitive)', () => {
    const rows = [
      { Email: 'tania_shedley@hotmail.co.uk', 'Full Name': 'Tania Shedley', Date: '2025-10-24' },
      { Email: 'Tania_Shedley@Hotmail.co.uk', 'Full Name': 'Tania Shedley', Date: '2025-11-10' },
    ]
    const result = dedupeDirectoryByEmail(rows)
    expect(result).toHaveLength(1)
  })

  it('prefers the most-recent row by Date column (DD/MM/YYYY sheet format)', () => {
    const rows = [
      { Email: 't@x.com', 'Full Name': 'T', Date: '24/10/2025', 'Phone number': '+447000000001' },
      { Email: 't@x.com', 'Full Name': 'T', Date: '10/11/2025', 'Phone number': '+447000000002' },
    ]
    const result = dedupeDirectoryByEmail(rows)
    expect(result).toHaveLength(1)
    expect(result[0]!['Phone number']).toBe('+447000000002')
  })

  it('keeps rows with blank/missing emails as-is (no collapse)', () => {
    const rows = [
      { 'Full Name': 'Anon 1' },
      { 'Full Name': 'Anon 2' },
      { Email: 'a@b.com', 'Full Name': 'A' },
    ]
    const result = dedupeDirectoryByEmail(rows)
    expect(result).toHaveLength(3)
  })

  it('trims surrounding whitespace when comparing emails', () => {
    const rows = [
      { Email: '  tania_shedley@hotmail.co.uk  ', 'Full Name': 'T' },
      { Email: 'tania_shedley@hotmail.co.uk', 'Full Name': 'T' },
    ]
    const result = dedupeDirectoryByEmail(rows)
    expect(result).toHaveLength(1)
  })

  it('preserves first-seen row when Date is missing on both duplicates', () => {
    const rows = [
      { Email: 't@x.com', 'Full Name': 'T1' },
      { Email: 't@x.com', 'Full Name': 'T2' },
    ]
    const result = dedupeDirectoryByEmail(rows)
    expect(result).toHaveLength(1)
    expect(result[0]!['Full Name']).toBe('T1')
  })
})
