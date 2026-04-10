import { describe, it, expect, vi, beforeEach } from 'vitest'

const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}))

describe('chatSynthesis', () => {
  beforeEach(() => {
    createMock.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    vi.resetModules()
  })

  it('synthesizes an answer from retrieved messages with citation markers', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'People are excited about Claude Code [1].' }],
      model: 'claude-sonnet-4-5',
    })

    const { synthesizeAnswer } = await import('../../server/services/chatSynthesis')
    const result = await synthesizeAnswer({
      query: 'What about Claude Code?',
      sources: [
        {
          id: '1',
          channel: 'ai',
          authorDisplayName: 'Dave',
          sentAt: '2026-03-11T15:00:00Z',
          messageText: 'Claude Code is amazing.',
        },
      ],
    })

    expect(result.answer).toContain('Claude Code')
    expect(result.model).toBe('claude-sonnet-4-5')
    expect(createMock).toHaveBeenCalledTimes(1)
    const [payload, options] = createMock.mock.calls[0]
    expect(payload.model).toBe('claude-sonnet-4-5')
    expect(payload.system).toContain('community knowledge synthesizer')
    expect(payload.messages[0].content).toContain('[1]')
    expect(payload.messages[0].content).toContain('Dave')
    expect(options?.timeout).toBe(20_000)
  })

  it('throws SynthesisUnavailableError when Claude errors out', async () => {
    createMock.mockRejectedValueOnce(new Error('request timed out'))

    const { synthesizeAnswer, SynthesisUnavailableError } = await import(
      '../../server/services/chatSynthesis'
    )
    await expect(
      synthesizeAnswer({ query: 'q', sources: [] }),
    ).rejects.toBeInstanceOf(SynthesisUnavailableError)
  })

  it('throws when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const mod = await import('../../server/services/chatSynthesis')
    await expect(
      mod.synthesizeAnswer({ query: 'q', sources: [] }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/)
  })

  it('formats empty-sources gracefully without crashing', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: "I couldn't find anything." }],
      model: 'claude-sonnet-4-5',
    })

    const { synthesizeAnswer } = await import('../../server/services/chatSynthesis')
    const result = await synthesizeAnswer({ query: 'obscure thing', sources: [] })
    expect(result.answer).toBeTruthy()
    expect(result.model).toBe('claude-sonnet-4-5')
    const payload = createMock.mock.calls[0][0]
    expect(payload.messages[0].content).toContain('(no sources retrieved)')
  })

  it('throws SynthesisUnavailableError when the response has no text block', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 't1', name: 'x', input: {} }],
      model: 'claude-sonnet-4-5',
    })

    const { synthesizeAnswer, SynthesisUnavailableError } = await import(
      '../../server/services/chatSynthesis'
    )
    await expect(
      synthesizeAnswer({ query: 'q', sources: [] }),
    ).rejects.toBeInstanceOf(SynthesisUnavailableError)
  })
})
