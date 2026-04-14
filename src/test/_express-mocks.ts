// Lightweight Express req/res mocks for middleware + route-handler tests.
// Shared across requireIngestAuth, chat-routes, and any future route suites.
import { vi } from 'vitest'
import type { Request, Response } from 'express'

export function makeRes(): Response {
  let headersSent = false
  const res = {
    get headersSent() {
      return headersSent
    },
    status: vi.fn(function (this: unknown, _code: number) {
      headersSent = true
      return res
    }),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    // 204 responses call res.end() directly without going through
    // res.json(). Expose it as a spy so handlers that use the
    // no-body success pattern can be asserted against.
    end: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

export function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    user: undefined,
    cookies: {},
    header: () => undefined,
    ...overrides,
  } as unknown as Request
}

/** Pull the first argument passed to res.json. Returns `undefined` if the
 *  handler never called it (e.g. on a middleware 401 before reaching the
 *  route). */
export function bodyOf(res: Response): unknown {
  const jsonMock = res.json as unknown as { mock: { calls: unknown[][] } }
  return jsonMock.mock.calls[0]?.[0]
}
