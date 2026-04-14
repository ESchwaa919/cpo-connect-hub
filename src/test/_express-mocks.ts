// Lightweight Express req/res mocks for middleware + route-handler tests.
// Shared across requireIngestAuth, chat-routes, and any future route suites.
import { vi } from 'vitest'
import type { Request, Response } from 'express'

export function makeRes(): Response {
  let headersSent = false
  const writes: string[] = []
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
    flushHeaders: vi.fn(function () {
      headersSent = true
      return res
    }),
    // `res.write` accumulates SSE chunks into an in-memory buffer that
    // tests can inspect via `sseChunks(res)`.
    write: vi.fn(function (chunk: string | Buffer) {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString('utf-8'))
      return true
    }),
    end: vi.fn(function (chunk?: string | Buffer) {
      if (chunk !== undefined) {
        writes.push(typeof chunk === 'string' ? chunk : chunk.toString('utf-8'))
      }
      return res
    }),
    // Test-only helper — not part of the real Express Response surface.
    __sseWrites: writes,
  } as unknown as Response
  return res
}

/** Parse the SSE chunks accumulated by `res.write` into structured
 *  events. Used by askHandler streaming tests. */
export function sseEvents(res: Response): Array<{ event: string; data: unknown }> {
  const writes = (res as unknown as { __sseWrites: string[] }).__sseWrites ?? []
  const buffer = writes.join('')
  const events: Array<{ event: string; data: unknown }> = []
  for (const chunk of buffer.split('\n\n')) {
    const lines = chunk.split('\n').filter((l) => l.length > 0)
    if (lines.length === 0) continue
    let eventName = 'message'
    let dataRaw = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) eventName = line.slice('event: '.length)
      else if (line.startsWith('data: ')) dataRaw += line.slice('data: '.length)
    }
    if (dataRaw.length === 0) continue
    let parsed: unknown = dataRaw
    try {
      parsed = JSON.parse(dataRaw)
    } catch {
      /* keep as raw string */
    }
    events.push({ event: eventName, data: parsed })
  }
  return events
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
