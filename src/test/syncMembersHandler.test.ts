import './_requireIngestAuth-setup'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { makeRes } from './_express-mocks'

const { mockSync } = vi.hoisted(() => ({
  mockSync: vi.fn(),
}))

vi.mock('../../server/services/members', () => ({
  syncMembersFromSheet: mockSync,
}))

import { syncMembersHandler } from '../../server/routes/chat'

describe('syncMembersHandler', () => {
  beforeEach(() => {
    mockSync.mockReset()
  })

  it('returns 200 and the sync result on success', async () => {
    mockSync.mockResolvedValueOnce({
      totalRows: 441,
      skippedNotJoined: 12,
      joinedTotal: 429,
      nameBlank: 0,
      phoneFailed: 2,
      phoneCollisions: 0,
      upserted: 427,
    })
    const req = {} as unknown as Request
    const res = makeRes() as Response

    await syncMembersHandler(req, res)

    expect(mockSync).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      totalRows: 441,
      skippedNotJoined: 12,
      joinedTotal: 429,
      nameBlank: 0,
      phoneFailed: 2,
      phoneCollisions: 0,
      upserted: 427,
    })
  })

  it('returns 500 when the sync throws', async () => {
    mockSync.mockRejectedValueOnce(new Error('sheets api dead'))
    const req = {} as unknown as Request
    const res = makeRes() as Response

    await syncMembersHandler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'internal' })
  })
})
