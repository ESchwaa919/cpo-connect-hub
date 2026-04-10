import { describe, it, expect, vi, beforeEach } from 'vitest'

const embedContentMock = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: embedContentMock,
    },
  })),
}))

describe('chatEmbedding', () => {
  beforeEach(() => {
    embedContentMock.mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
    vi.resetModules()
  })

  it('embeds a query and returns a 768-dimensional vector', async () => {
    embedContentMock.mockResolvedValueOnce({
      embeddings: [{ values: new Array(768).fill(0.1) }],
    })

    const { embedQuery } = await import('../../server/services/chatEmbedding')
    const vec = await embedQuery('What are people saying about Claude Code?')

    expect(vec).toHaveLength(768)
    expect(embedContentMock).toHaveBeenCalledTimes(1)
    const call = embedContentMock.mock.calls[0][0]
    expect(call.model).toBe('gemini-embedding-2-preview')
    expect(call.contents).toContain('Represent this search query')
  })

  it('throws EmbeddingUnavailableError when the API returns no embeddings', async () => {
    embedContentMock.mockResolvedValueOnce({ embeddings: [] })

    const { embedQuery, EmbeddingUnavailableError } = await import(
      '../../server/services/chatEmbedding'
    )
    await expect(embedQuery('hello')).rejects.toBeInstanceOf(
      EmbeddingUnavailableError,
    )
  })

  it('wraps API errors in EmbeddingUnavailableError', async () => {
    embedContentMock.mockRejectedValueOnce(new Error('429 Too Many Requests'))

    const { embedQuery, EmbeddingUnavailableError } = await import(
      '../../server/services/chatEmbedding'
    )
    await expect(embedQuery('hello')).rejects.toBeInstanceOf(
      EmbeddingUnavailableError,
    )
  })

  it('throws when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY
    const { embedQuery } = await import('../../server/services/chatEmbedding')
    await expect(embedQuery('hello')).rejects.toThrow(/GEMINI_API_KEY/)
  })
})
