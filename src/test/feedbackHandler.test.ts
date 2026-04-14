import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { makeRes, makeReq, bodyOf } from './_express-mocks'

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}))

vi.mock('../../server/db', () => ({
  default: { query: mockQuery, end: vi.fn() },
}))

// Mock the rate-limit service so feedbackHandler doesn't transitively
// pull in a real Redis client when chat.ts is loaded.
vi.mock('../../server/services/chatEmbedding', () => ({
  embedQuery: vi.fn(),
  EmbeddingUnavailableError: class extends Error {
    readonly code = 'embedding_unavailable' as const
  },
}))
vi.mock('../../server/services/chatSynthesis', () => ({
  synthesizeAnswer: vi.fn(),
  SynthesisUnavailableError: class extends Error {
    readonly code = 'synthesis_unavailable' as const
  },
}))

import { feedbackHandler } from '../../server/routes/chat'

function reqWithBody(body: unknown, email = 'owner@example.com'): Request {
  return makeReq({
    body,
    user: { id: 's', email, name: 'Owner' },
  } as unknown as Partial<Request>) as Request
}

describe('feedbackHandler', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('rejects an empty body with 400', async () => {
    const res = makeRes() as Response
    await feedbackHandler(reqWithBody({}), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(bodyOf(res)).toMatchObject({ error: 'bad_query' })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric queryLogId with 400 (does not reach SQL)', async () => {
    const res = makeRes() as Response
    await feedbackHandler(
      reqWithBody({ queryLogId: 'foo', rating: 'thumbs_up' }),
      res,
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(bodyOf(res)).toMatchObject({ error: 'bad_query' })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a negative integer queryLogId with 400', async () => {
    const res = makeRes() as Response
    await feedbackHandler(
      reqWithBody({ queryLogId: '-5', rating: 'thumbs_up' }),
      res,
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects an unknown rating value with 400', async () => {
    const res = makeRes() as Response
    await feedbackHandler(
      reqWithBody({ queryLogId: '42', rating: 'meh' }),
      res,
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects an overly long queryLogId with 400', async () => {
    const res = makeRes() as Response
    await feedbackHandler(
      reqWithBody({ queryLogId: '1'.repeat(25), rating: 'thumbs_up' }),
      res,
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 404 when the INSERT ... SELECT produces zero rows (not found OR not owner)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 })
    const res = makeRes() as Response
    await feedbackHandler(
      reqWithBody({ queryLogId: '42', rating: 'thumbs_up' }),
      res,
    )
    expect(res.status).toHaveBeenCalledWith(404)
    expect(bodyOf(res)).toMatchObject({ error: 'query_log_not_found' })
  })

  it('returns 204 when the feedback row is inserted (caller owns the log row)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    const res = makeRes() as Response
    await feedbackHandler(
      reqWithBody({ queryLogId: '42', rating: 'thumbs_up' }),
      res,
    )
    expect(res.status).not.toHaveBeenCalledWith(400)
    expect(res.end).toHaveBeenCalled()

    // Verify the INSERT ... SELECT was issued with the correct
    // ownership predicate (user_id = $3) and the parameters in the
    // right order.
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO cpo_connect\.chat_query_feedback/)
    expect(sql).toMatch(/WHERE id = \$1::bigint AND user_id = \$3/)
    expect(params).toEqual(['42', 'thumbs_up', 'owner@example.com'])
  })

  it('accepts thumbs_down alongside thumbs_up', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    const res = makeRes() as Response
    await feedbackHandler(
      reqWithBody({ queryLogId: '99', rating: 'thumbs_down' }),
      res,
    )
    expect(mockQuery.mock.calls[0][1]).toEqual([
      '99',
      'thumbs_down',
      'owner@example.com',
    ])
  })

  it('normalizes the caller email to lowercase for the ownership check', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    const res = makeRes() as Response
    await feedbackHandler(
      reqWithBody(
        { queryLogId: '42', rating: 'thumbs_up' },
        'OWNER@Example.COM',
      ),
      res,
    )
    expect(mockQuery.mock.calls[0][1][2]).toBe('owner@example.com')
  })
})
