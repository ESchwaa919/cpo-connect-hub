import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-embedding-2-preview'
const QUERY_INSTRUCTION =
  'Represent this search query for retrieving relevant community chat messages.'
const ERROR_CODE = 'embedding_unavailable' as const

export class EmbeddingUnavailableError extends Error {
  readonly code = ERROR_CODE
  constructor(cause: string) {
    super(`${ERROR_CODE}: ${cause}`)
    this.name = 'EmbeddingUnavailableError'
    // Preserve prototype chain across transpile targets so `instanceof` works
    // reliably inside test mocks that use `vi.resetModules()`.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// Rotating GEMINI_API_KEY requires a process restart — the client is cached
// for the lifetime of the process and does not re-read env on subsequent calls.
let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

export async function embedQuery(query: string): Promise<number[]> {
  const c = getClient()
  let response
  try {
    response = await c.models.embedContent({
      model: MODEL,
      contents: `${QUERY_INSTRUCTION}\n\n${query}`,
      config: { outputDimensionality: 768 },
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
