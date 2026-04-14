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
      stop_reason: 'end_turn',
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

  // Determinism + soft-inference rule — two complementary guarantees
  // fixing the "same query, two wildly different answers" regression
  // Erik hit on the Dex query in prod.
  it('passes temperature: 0.2 to Claude for near-deterministic synthesis', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4-5',
      stop_reason: 'end_turn',
    })
    const { synthesizeAnswer } = await import('../../server/services/chatSynthesis')
    await synthesizeAnswer({ query: 'q', sources: [] })
    const [payload] = createMock.mock.calls[0]
    expect(payload.temperature).toBe(0.2)
  })

  it('system prompt directs Claude to synthesize from what is there (launch readiness directive rule)', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4-5',
      stop_reason: 'end_turn',
    })
    const { synthesizeAnswer } = await import('../../server/services/chatSynthesis')
    await synthesizeAnswer({ query: 'q', sources: [] })
    const [payload] = createMock.mock.calls[0]
    const system = payload.system as string
    // Launch readiness cluster C: the rule is now DIRECTIVE (MUST
    // synthesize) not permissive (may infer). Keeps the hedging
    // phrases + fabrication guardrail from the previous iteration.
    expect(system).toContain('you MUST synthesize')
    expect(system).toContain('appears to be')
    expect(system).toContain('Never invent specific facts')
    // Old over-strict rule phrasing must be gone — it was the
    // "If the sources don't contain enough info, say so plainly. Don't
    // fabricate." line that caused Run-2 refusals.
    expect(system).not.toContain("Don't fabricate")
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
      stop_reason: 'end_turn',
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
      stop_reason: 'end_turn',
    })

    const { synthesizeAnswer, SynthesisUnavailableError } = await import(
      '../../server/services/chatSynthesis'
    )
    await expect(
      synthesizeAnswer({ query: 'q', sources: [] }),
    ).rejects.toBeInstanceOf(SynthesisUnavailableError)
  })

  // Anything other than 'end_turn' is a refusal, truncation, or anomaly —
  // must surface as synthesis failure (spec 503 response) instead of
  // leaking partial text to the user. See codex CLI pass 3.
  it.each([
    ['max_tokens'],
    ['refusal'],
    ['content_filter'],
    ['stop_sequence'],
    ['tool_use'],
    ['pause_turn'],
  ])(
    'throws SynthesisUnavailableError when Claude stop_reason is %s',
    async (stopReason) => {
      createMock.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'partial or refusal text' }],
        model: 'claude-sonnet-4-5',
        stop_reason: stopReason,
      })

      const { synthesizeAnswer, SynthesisUnavailableError } = await import(
        '../../server/services/chatSynthesis'
      )
      await expect(
        synthesizeAnswer({ query: 'q', sources: [] }),
      ).rejects.toBeInstanceOf(SynthesisUnavailableError)
    },
  )
})
