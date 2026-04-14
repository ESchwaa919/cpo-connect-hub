import { describe, it, expect, vi, beforeEach } from 'vitest'

// We stub the Anthropic SDK module BEFORE importing the module under test
// so the shared client inside chatSynthesis.ts uses the fake.
const { mockStream, mockClientCtor } = vi.hoisted(() => ({
  mockStream: vi.fn(),
  mockClientCtor: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { stream: mockStream, create: vi.fn() }
    constructor(_opts: unknown) {
      mockClientCtor(_opts)
    }
  }
  return { default: MockAnthropic }
})

// Needed so `getClient()` doesn't throw on missing API key.
process.env.ANTHROPIC_API_KEY = 'test-key'

import {
  synthesizeAnswerStream,
  SynthesisUnavailableError,
  type SynthesisInput,
} from '../../server/services/chatSynthesis'

function input(overrides: Partial<SynthesisInput> = {}): SynthesisInput {
  return {
    query: 'what did people say',
    sources: [
      {
        id: '1',
        channel: 'ai',
        authorDisplayName: 'Sarah',
        sentAt: '2026-03-01T00:00:00Z',
        messageText: 'I like LLMs',
      },
    ],
    ...overrides,
  }
}

/** Build a stream stub that yields a sequence of events via async
 *  iteration and exposes a finalMessage() that resolves with the given
 *  final object. Matches the shape of Anthropic's MessageStream class
 *  enough for synthesizeAnswerStream's consumption pattern. */
function fakeStream(
  events: Array<unknown>,
  final:
    | { stop_reason: string; model: string }
    | { throws: Error } = { stop_reason: 'end_turn', model: 'claude-sonnet-4-5' },
) {
  async function* iter() {
    for (const e of events) yield e
  }
  return {
    [Symbol.asyncIterator]: iter,
    async finalMessage() {
      if ('throws' in final) throw final.throws
      return final
    },
  }
}

describe('synthesizeAnswerStream', () => {
  beforeEach(() => {
    mockStream.mockReset()
  })

  it('yields token events for each text_delta then a done event', async () => {
    mockStream.mockReturnValueOnce(
      fakeStream([
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hello' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: ' world' },
        },
        { type: 'content_block_stop', index: 0 },
      ]),
    )

    const events: unknown[] = []
    for await (const e of synthesizeAnswerStream(input())) {
      events.push(e)
    }

    expect(events).toEqual([
      { kind: 'token', text: 'Hello' },
      { kind: 'token', text: ' world' },
      { kind: 'done', model: 'claude-sonnet-4-5' },
    ])
  })

  it('ignores non-text-delta events', async () => {
    mockStream.mockReturnValueOnce(
      fakeStream([
        { type: 'message_start', message: { id: 'msg_1' } },
        { type: 'content_block_start', index: 0 },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'hi' },
        },
        { type: 'message_delta', delta: {}, usage: {} },
      ]),
    )

    const events: unknown[] = []
    for await (const e of synthesizeAnswerStream(input())) {
      events.push(e)
    }

    expect(events).toEqual([
      { kind: 'token', text: 'hi' },
      { kind: 'done', model: 'claude-sonnet-4-5' },
    ])
  })

  it('throws SynthesisUnavailableError when stop_reason is not end_turn', async () => {
    mockStream.mockReturnValueOnce(
      fakeStream(
        [
          {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'partial' },
          },
        ],
        { stop_reason: 'max_tokens', model: 'claude-sonnet-4-5' },
      ),
    )

    const gen = synthesizeAnswerStream(input())
    const first = await gen.next()
    expect(first.value).toEqual({ kind: 'token', text: 'partial' })
    await expect(gen.next()).rejects.toThrow(SynthesisUnavailableError)
  })

  it('throws SynthesisUnavailableError when the SDK throws on stream setup', async () => {
    mockStream.mockImplementationOnce(() => {
      throw new Error('sdk boom')
    })

    const gen = synthesizeAnswerStream(input())
    await expect(gen.next()).rejects.toThrow(SynthesisUnavailableError)
  })

  it('throws SynthesisUnavailableError when finalMessage rejects', async () => {
    mockStream.mockReturnValueOnce(
      fakeStream(
        [
          {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'ok' },
          },
        ],
        { throws: new Error('aborted') },
      ),
    )

    const gen = synthesizeAnswerStream(input())
    const first = await gen.next()
    expect(first.value).toEqual({ kind: 'token', text: 'ok' })
    await expect(gen.next()).rejects.toThrow(SynthesisUnavailableError)
  })
})
