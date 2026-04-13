import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockQuery, mockSync, mockResolveAuthor } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockSync: vi.fn(),
  mockResolveAuthor: vi.fn(),
}))

vi.mock('../../server/db', () => ({
  default: { query: mockQuery, end: vi.fn() },
}))
vi.mock('../../server/services/members', () => ({
  syncMembersFromSheet: mockSync,
}))
vi.mock('../../server/lib/resolveAuthor', () => ({
  resolveAuthor: mockResolveAuthor,
}))

import { backfillMemberIdentity } from '../../scripts/backfill-member-identity'

describe('backfillMemberIdentity', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockSync.mockReset()
    mockResolveAuthor.mockReset()
    mockSync.mockResolvedValue({
      totalRows: 0,
      skippedNotJoined: 0,
      nameBlank: 0,
      phoneFailed: 0,
      upserted: 0,
    })
  })

  it('syncs members before querying, then resolves every NULL row', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: '1', author_name: '+44 7911 123456', author_email: null },
        { id: '2', author_name: 'Sarah Jenkins', author_email: null },
      ],
    })
    mockResolveAuthor.mockImplementation((raw: string) => {
      if (raw.startsWith('+')) {
        return { senderPhone: '+447911123456', senderDisplayName: 'Sarah Jenkins' }
      }
      return { senderPhone: null, senderDisplayName: 'Sarah Jenkins' }
    })
    // UPDATE responses
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [] })

    const result = await backfillMemberIdentity({ dryRun: false })

    expect(mockSync).toHaveBeenCalledTimes(1)
    expect(mockSync).toHaveBeenCalledBefore(mockQuery)

    // First call is the SELECT
    expect(mockQuery.mock.calls[0][0]).toMatch(/SELECT id::text/i)
    expect(mockQuery.mock.calls[0][0]).toMatch(/sender_phone IS NULL/i)

    // Two UPDATE calls (one per row)
    const updateCalls = mockQuery.mock.calls.filter((c) =>
      typeof c[0] === 'string' && c[0].includes('UPDATE cpo_connect.chat_messages'),
    )
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0][1]).toEqual([
      '+447911123456',
      'Sarah Jenkins',
      '1',
    ])
    expect(updateCalls[1][1]).toEqual([null, 'Sarah Jenkins', '2'])

    expect(result.processed).toBe(2)
    expect(result.updated).toBe(2)
    expect(result.unresolved).toBe(0)
  })

  it('counts unresolved rows (both fields null) without issuing an UPDATE', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: '5', author_name: 'Unknown Person', author_email: null }],
    })
    mockResolveAuthor.mockReturnValue({
      senderPhone: null,
      senderDisplayName: null,
    })

    const result = await backfillMemberIdentity({ dryRun: false })

    const updateCalls = mockQuery.mock.calls.filter((c) =>
      typeof c[0] === 'string' && c[0].includes('UPDATE cpo_connect.chat_messages'),
    )
    expect(updateCalls).toHaveLength(0)
    expect(result.processed).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.unresolved).toBe(1)
  })

  it('dryRun=true does NOT issue UPDATE statements', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: '7', author_name: '+44 7911 123456', author_email: null }],
    })
    mockResolveAuthor.mockReturnValue({
      senderPhone: '+447911123456',
      senderDisplayName: 'Sarah Jenkins',
    })

    const result = await backfillMemberIdentity({ dryRun: true })

    const updateCalls = mockQuery.mock.calls.filter((c) =>
      typeof c[0] === 'string' && c[0].includes('UPDATE cpo_connect.chat_messages'),
    )
    expect(updateCalls).toHaveLength(0)
    expect(result.processed).toBe(1)
    expect(result.updated).toBe(1)
  })

  it('is idempotent when the second pass finds no NULL rows', async () => {
    // First pass: one row, resolved
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: '9', author_name: '+44 7911 123456', author_email: null }],
    })
    mockResolveAuthor.mockReturnValue({
      senderPhone: '+447911123456',
      senderDisplayName: 'Sarah Jenkins',
    })
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] })
    const first = await backfillMemberIdentity({ dryRun: false })
    expect(first.processed).toBe(1)

    // Second pass: SELECT returns zero rows → no UPDATEs, zero processed.
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    const second = await backfillMemberIdentity({ dryRun: false })
    expect(second.processed).toBe(0)
    expect(second.updated).toBe(0)
  })

  it('continues processing even when syncMembersFromSheet throws', async () => {
    mockSync.mockRejectedValueOnce(new Error('sheets api down'))
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: '11', author_name: 'Sarah Jenkins', author_email: null }],
    })
    mockResolveAuthor.mockReturnValue({
      senderPhone: null,
      senderDisplayName: 'Sarah Jenkins',
    })
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] })

    const result = await backfillMemberIdentity({ dryRun: false })
    expect(result.processed).toBe(1)
    expect(result.updated).toBe(1)
  })
})
