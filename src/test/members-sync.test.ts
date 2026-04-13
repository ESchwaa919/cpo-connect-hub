import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories run BEFORE top-level const declarations, so the
// mock fns must be created via vi.hoisted() to be accessible inside
// them.
const { mockFetchSheet1RawRows, mockQuery } = vi.hoisted(() => ({
  mockFetchSheet1RawRows: vi.fn(),
  mockQuery: vi.fn(),
}))

vi.mock('../../server/services/sheets', () => ({
  fetchSheet1RawRows: mockFetchSheet1RawRows,
}))
vi.mock('../../server/db', () => ({
  default: { query: mockQuery },
}))

import {
  syncMembersFromSheet,
  getMemberByPhone,
  getMemberByEmail,
  getMemberByNameCaseInsensitive,
} from '../../server/services/members'

describe('syncMembersFromSheet', () => {
  beforeEach(() => {
    mockFetchSheet1RawRows.mockReset()
    mockQuery.mockReset()
  })

  it('upserts rows with Status=Joined and normalized E.164 phones', async () => {
    mockFetchSheet1RawRows.mockResolvedValueOnce([
      {
        'Full Name': 'Sarah Jenkins',
        Email: 'sarah@example.com',
        'Phone number': '07911 123456',
        Status: 'Joined',
      },
      {
        'Full Name': 'Marcus Okonkwo',
        Email: 'marcus@example.com',
        'Phone number': '07123 456789',
        Status: 'Joined',
      },
      {
        'Full Name': 'Not Yet',
        Email: 'nope@example.com',
        'Phone number': '07911 222333',
        Status: 'Applied',
      },
    ])
    mockQuery.mockResolvedValue({ rowCount: 1 })

    const result = await syncMembersFromSheet()

    const upsertCalls = mockQuery.mock.calls.filter(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('INSERT INTO cpo_connect.members'),
    )
    expect(upsertCalls).toHaveLength(2)
    expect(result.upserted).toBe(2)
    expect(result.skippedNotJoined).toBe(1)
    expect(result.phoneFailed).toBe(0)
  })

  it('skips rows with invalid phone numbers and counts them', async () => {
    mockFetchSheet1RawRows.mockResolvedValueOnce([
      {
        'Full Name': 'Valid Member',
        Email: 'v@example.com',
        'Phone number': '07911 123456',
        Status: 'Joined',
      },
      {
        'Full Name': 'Bad Phone',
        Email: 'b@example.com',
        'Phone number': 'not-a-number',
        Status: 'Joined',
      },
    ])
    mockQuery.mockResolvedValue({ rowCount: 1 })

    const result = await syncMembersFromSheet()
    expect(result.upserted).toBe(1)
    expect(result.phoneFailed).toBe(1)
  })

  it('skips rows with blank Full Name', async () => {
    mockFetchSheet1RawRows.mockResolvedValueOnce([
      {
        'Full Name': '',
        Email: 'x@example.com',
        'Phone number': '07911 123456',
        Status: 'Joined',
      },
    ])
    mockQuery.mockResolvedValue({ rowCount: 0 })

    const result = await syncMembersFromSheet()
    expect(result.upserted).toBe(0)
    expect(result.nameBlank).toBe(1)
  })

  it('matches Status case-insensitively (lowercase `joined`)', async () => {
    mockFetchSheet1RawRows.mockResolvedValueOnce([
      {
        'Full Name': 'Lowercase Status',
        Email: 'ls@example.com',
        'Phone number': '07911 123456',
        Status: 'joined',
      },
    ])
    mockQuery.mockResolvedValue({ rowCount: 1 })

    const result = await syncMembersFromSheet()
    expect(result.upserted).toBe(1)
  })
})

describe('getMemberByPhone / Email / NameCaseInsensitive', () => {
  beforeEach(() => {
    mockFetchSheet1RawRows.mockReset()
    mockQuery.mockReset()
  })

  it('returns the cached member after a successful sync', async () => {
    mockFetchSheet1RawRows.mockResolvedValueOnce([
      {
        'Full Name': 'Sarah Jenkins',
        Email: 'sarah@example.com',
        'Phone number': '07911 123456',
        Status: 'Joined',
      },
    ])
    mockQuery.mockResolvedValue({ rowCount: 1 })
    await syncMembersFromSheet()

    const byPhone = getMemberByPhone('+447911123456')
    expect(byPhone?.displayName).toBe('Sarah Jenkins')
    expect(byPhone?.email).toBe('sarah@example.com')

    const byEmail = getMemberByEmail('SARAH@example.com')
    expect(byEmail?.displayName).toBe('Sarah Jenkins')

    const byName = getMemberByNameCaseInsensitive('sarah jenkins')
    expect(byName?.phone).toBe('+447911123456')
  })

  it('returns null for lookups that do not match the cache', async () => {
    mockFetchSheet1RawRows.mockResolvedValueOnce([])
    await syncMembersFromSheet()

    expect(getMemberByPhone('+447911000000')).toBeNull()
    expect(getMemberByEmail('nobody@example.com')).toBeNull()
    expect(getMemberByNameCaseInsensitive('Nobody')).toBeNull()
  })
})
