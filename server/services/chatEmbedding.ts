import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  getGeminiClient,
} from './geminiClient.ts'

const QUERY_INSTRUCTION =
  'Represent this search query for retrieving relevant community chat messages.'
const ERROR_CODE = 'embedding_unavailable' as const

export class EmbeddingUnavailableError extends Error {
  readonly code = ERROR_CODE
  constructor(cause: string) {
    super(`${ERROR_CODE}: ${cause}`)
    this.name = 'EmbeddingUnavailableError'
    // Preserve prototype chain so `instanceof` works reliably inside test
    // mocks that use `vi.resetModules()`.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export async function embedQuery(query: string): Promise<number[]> {
  const c = getGeminiClient()
  let response
  try {
    response = await c.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: `${QUERY_INSTRUCTION}\n\n${query}`,
      config: { outputDimensionality: EMBEDDING_DIM },
    })
  } catch (err) {
    throw new EmbeddingUnavailableError((err as Error).message)
  }

  const vec = response.embeddings?.[0]?.values
  if (!vec || vec.length === 0) {
    throw new EmbeddingUnavailableError('no embedding returned')
  }
  return vec
}
