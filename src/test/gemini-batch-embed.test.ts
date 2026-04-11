import { describe, it, expect, vi, beforeEach } from 'vitest'

const embedContentMock = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: embedContentMock,
    },
  })),
}))

describe('gemini-batch-embed', () => {
  beforeEach(() => {
    embedContentMock.mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
    vi.resetModules()
  })

  it('embeds every item sequentially and returns them in input order', async () => {
    embedContentMock
      .mockResolvedValueOnce({ embeddings: [{ values: new Array(768).fill(0.1) }] })
      .mockResolvedValueOnce({ embeddings: [{ values: new Array(768).fill(0.2) }] })
      .mockResolvedValueOnce({ embeddings: [{ values: new Array(768).fill(0.3) }] })

    const { embedBatch } = await import('../../scripts/lib/gemini-batch-embed')
    const result = await embedBatch([
      { id: 'a', text: 'first' },
      { id: 'b', text: 'second' },
      { id: 'c', text: 'third' },
    ])

    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(result[0].embedding[0]).toBeCloseTo(0.1)
    expect(result[2].embedding[0]).toBeCloseTo(0.3)
    expect(embedContentMock).toHaveBeenCalledTimes(3)
    // Every call should use the ingest instruction (different from query instruction).
    for (const call of embedContentMock.mock.calls) {
      expect(call[0].contents).toContain('Represent this community chat message')
      expect(call[0].config.outputDimensionality).toBe(768)
    }
  })

  it('retries once on transient failure before giving up', async () => {
    embedContentMock
      .mockRejectedValueOnce(new Error('503 transient'))
      .mockResolvedValueOnce({ embeddings: [{ values: new Array(768).fill(0.5) }] })

    const { embedBatch } = await import('../../scripts/lib/gemini-batch-embed')
    const result = await embedBatch([{ id: 'x', text: 'needs retry' }])

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('x')
    expect(embedContentMock).toHaveBeenCalledTimes(2)
  })

  it('throws after both attempts fail', async () => {
    embedContentMock
      .mockRejectedValueOnce(new Error('500 fail one'))
      .mockRejectedValueOnce(new Error('500 fail two'))

    const { embedBatch } = await import('../../scripts/lib/gemini-batch-embed')
    await expect(embedBatch([{ id: 'x', text: 'hi' }])).rejects.toThrow(
      /500 fail two/,
    )
    expect(embedContentMock).toHaveBeenCalledTimes(2)
  })

  it('returns an empty array immediately for an empty input', async () => {
    const { embedBatch } = await import('../../scripts/lib/gemini-batch-embed')
    expect(await embedBatch([])).toEqual([])
    expect(embedContentMock).not.toHaveBeenCalled()
  })
})
