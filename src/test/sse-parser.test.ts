import { describe, it, expect } from 'vitest'
import { readSSE, type SSEEvent } from '../lib/sse-parser'

/** Build a ReadableStream of UTF-8 encoded chunks from raw strings.
 *  Each string is one chunk — the parser must tolerate boundaries
 *  landing anywhere. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<SSEEvent[]> {
  const events: SSEEvent[] = []
  for await (const e of readSSE(stream.getReader())) {
    events.push(e)
  }
  return events
}

describe('readSSE', () => {
  it('parses a single event', async () => {
    const events = await collect(
      streamOf(['event: token\ndata: {"text":"hello"}\n\n']),
    )
    expect(events).toEqual([
      { event: 'token', data: '{"text":"hello"}' },
    ])
  })

  it('parses multiple events in one chunk', async () => {
    const events = await collect(
      streamOf([
        'event: sources\ndata: {"sources":[]}\n\nevent: token\ndata: {"text":"hi"}\n\nevent: done\ndata: {"model":"x"}\n\n',
      ]),
    )
    expect(events.map((e) => e.event)).toEqual(['sources', 'token', 'done'])
    expect(events[1].data).toBe('{"text":"hi"}')
  })

  it('parses an event split across multiple chunks at the event boundary', async () => {
    const events = await collect(
      streamOf([
        'event: token\ndata: {"text":"hel',
        'lo"}\n\nevent: done\n',
        'data: {"model":"x"}\n\n',
      ]),
    )
    expect(events).toEqual([
      { event: 'token', data: '{"text":"hello"}' },
      { event: 'done', data: '{"model":"x"}' },
    ])
  })

  it('parses an event split mid-line', async () => {
    const events = await collect(
      streamOf(['event: to', 'ken\ndata: {"t', 'ext":"x"}\n\n']),
    )
    expect(events).toEqual([{ event: 'token', data: '{"text":"x"}' }])
  })

  it('handles \\r\\n line endings', async () => {
    const events = await collect(
      streamOf(['event: token\r\ndata: hi\r\n\r\n']),
    )
    expect(events).toEqual([{ event: 'token', data: 'hi' }])
  })

  it('ignores comment lines (starting with :)', async () => {
    const events = await collect(
      streamOf([': keep-alive\nevent: token\ndata: hi\n\n']),
    )
    expect(events).toEqual([{ event: 'token', data: 'hi' }])
  })

  it('defaults to event name "message" when `event:` is absent', async () => {
    const events = await collect(streamOf(['data: hello\n\n']))
    expect(events).toEqual([{ event: 'message', data: 'hello' }])
  })

  it('concatenates multiple data: lines with a newline separator', async () => {
    const events = await collect(
      streamOf(['event: multi\ndata: line1\ndata: line2\n\n']),
    )
    expect(events).toEqual([{ event: 'multi', data: 'line1\nline2' }])
  })

  it('drops events with no data lines', async () => {
    const events = await collect(
      streamOf(['event: heartbeat\n\nevent: token\ndata: hi\n\n']),
    )
    expect(events).toEqual([{ event: 'token', data: 'hi' }])
  })

  it('flushes a trailing event without a closing blank line', async () => {
    const events = await collect(streamOf(['event: done\ndata: {"model":"x"}']))
    expect(events).toEqual([{ event: 'done', data: '{"model":"x"}' }])
  })
})
