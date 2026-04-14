// Minimal Server-Sent Events parser for a single `fetch()` response
// body. Handles multi-line `data:` values, partial chunks straddling
// event boundaries, and `\r\n` line endings. No dependencies.
//
// Usage:
//   const reader = response.body!.getReader()
//   for await (const event of readSSE(reader)) {
//     // event.event, event.data
//   }

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
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary).replace(/^(\r?\n\r?\n)/, '')
        const event = parseEvent(raw)
        if (event) yield event
        boundary = findBoundary(buffer)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Return the index of the first event-separator (`\n\n` or `\r\n\r\n`)
 *  in the buffer, or -1 if none. */
function findBoundary(buffer: string): number {
  const nn = buffer.indexOf('\n\n')
  const rn = buffer.indexOf('\r\n\r\n')
  if (nn === -1) return rn
  if (rn === -1) return nn
  return Math.min(nn, rn)
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
