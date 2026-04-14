// Lightweight Express req/res mocks for middleware + route-handler tests.
// Shared across requireIngestAuth, chat-routes, and any future route suites.
import { vi } from 'vitest'
import type { Request, Response } from 'express'
import { readSSE, type SSEEvent } from '../lib/sse-parser'

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
 *  events. Drives the real `readSSE` parser from src/lib/sse-parser so
 *  the tests exercise the same code path as the production client —
 *  prevents the two implementations from drifting. */
export async function sseEvents(
  res: Response,
): Promise<Array<{ event: string; data: unknown }>> {
  const writes = (res as unknown as { __sseWrites: string[] }).__sseWrites ?? []
  const buffer = writes.join('')
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(buffer))
      controller.close()
    },
  })
  const out: Array<{ event: string; data: unknown }> = []
  for await (const event of readSSE(stream.getReader())) {
    let parsed: unknown = event.data
    try {
      parsed = JSON.parse(event.data)
    } catch {
      /* keep as raw string */
    }
    out.push({ event: event.event, data: parsed })
  }
  return out
}

export type { SSEEvent }

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
