// Minimal Server-Sent Events parser for a single `fetch()` response
// body. Handles multi-line `data:` values, partial chunks straddling
// event boundaries, and `\r\n` line endings. No dependencies.
//
// Usage:
//   const reader = response.body!.getReader()
//   for await (const event of readSSE(reader)) {
//     // event.event, event.data
//   }

/** Shared event-name catalog for the /api/chat/ask SSE protocol. Used
 *  by the server handler (emission), the client streamAsk (parsing),
 *  and the handler tests (assertion). Single source of truth prevents
 *  a typo in any one place from silently breaking the wire format. */
export const CHAT_SSE_EVENTS = {
  sources: 'sources',
  token: 'token',
  done: 'done',
  empty: 'empty',
  error: 'error',
} as const
export type ChatSSEEventName =
  (typeof CHAT_SSE_EVENTS)[keyof typeof CHAT_SSE_EVENTS]

export interface SSEEvent {
  /** Event name from `event:` line. Defaults to `'message'`. */
  event: string
  /** Concatenated `data:` lines with newlines between them. */
  data: string
}

/** Async-iterate over SSE events in a Fetch response body reader. */
export async function* readSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SSEEvent, void, unknown> {
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        // Flush any remaining buffered event if the stream ends without
        // a trailing blank line (non-spec but common).
        const trailing = parseEvent(buffer)
        if (trailing) yield trailing
        return
      }
      buffer += decoder.decode(value, { stream: true })

      let boundary = findBoundary(buffer)
      while (boundary !== null) {
        const raw = buffer.slice(0, boundary.index)
        // Slice past the matched separator in a single step — no extra
        // string allocation + regex round-trip per boundary.
        buffer = buffer.slice(boundary.index + boundary.length)
        const event = parseEvent(raw)
        if (event) yield event
        boundary = findBoundary(buffer)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Return the index + length of the first event-separator (`\n\n` or
 *  `\r\n\r\n`) in the buffer, or null if none. */
function findBoundary(
  buffer: string,
): { index: number; length: number } | null {
  const nn = buffer.indexOf('\n\n')
  const rn = buffer.indexOf('\r\n\r\n')
  if (nn === -1 && rn === -1) return null
  if (nn === -1) return { index: rn, length: 4 }
  if (rn === -1) return { index: nn, length: 2 }
  return nn <= rn ? { index: nn, length: 2 } : { index: rn, length: 4 }
}

/** Parse a single event chunk (one or more `field: value` lines,
 *  no trailing blank line) into an SSEEvent. Returns null for
 *  comment-only or empty chunks. */
function parseEvent(raw: string): SSEEvent | null {
  if (raw.length === 0) return null
  let eventName = 'message'
  const dataLines: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (line.length === 0 || line.startsWith(':')) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const field = line.slice(0, colonIdx)
    // Spec: one optional space after the colon.
    let value = line.slice(colonIdx + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') eventName = value
    else if (field === 'data') dataLines.push(value)
    // `id` and `retry` fields are intentionally ignored — the askHandler
    // stream doesn't use them.
  }
  if (dataLines.length === 0) return null
  return { event: eventName, data: dataLines.join('\n') }
}
