// Sequential Gemini embedding wrapper for the local ingestion script.
//
// Phase 1 design choice: embed one message at a time rather than batching.
// A monthly WhatsApp export is hundreds to low thousands of messages; at
// Gemini's rate limits the wall-clock is fine and sequential-with-retry is
// dramatically simpler than batch coordination. Revisit if corpus grows.
//
// Uses the INGEST instruction, which intentionally differs from the query
// instruction in server/services/chatEmbedding.ts — Gemini's documented
// best practice for asymmetric retrieval embeddings.

import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  getGeminiClient,
} from '../../server/services/geminiClient.ts'

const INGEST_INSTRUCTION =
  'Represent this community chat message for semantic search.'
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 500

export interface EmbedItem {
  id: string
  text: string
}

export interface EmbeddedItem extends EmbedItem {
  embedding: number[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function embedOne(text: string): Promise<number[]> {
  const c = getGeminiClient()
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await c.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: `${INGEST_INSTRUCTION}\n\n${text}`,
        config: { outputDimensionality: EMBEDDING_DIM },
      })
      const vec = response.embeddings?.[0]?.values
      if (!vec || vec.length === 0) {
        throw new Error('Gemini returned no embedding values')
      }
      return vec
    } catch (err) {
      lastError = err as Error
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS)
      }
    }
  }
  throw lastError!
}

export async function embedBatch(items: EmbedItem[]): Promise<EmbeddedItem[]> {
  if (items.length === 0) return []
  const out: EmbeddedItem[] = []
  for (const item of items) {
    const embedding = await embedOne(item.text)
    out.push({ ...item, embedding })
  }
  return out
}
