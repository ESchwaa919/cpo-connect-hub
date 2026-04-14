// Local embedding pipeline using @xenova/transformers (BAAI bge-small-en-v1.5).
// Replaces the per-query Gemini round-trip on the askHandler hot path —
// ~15 ms CPU inference vs ~300 ms network call to Google. Removes the
// per-query API cost entirely.
//
// Loaded lazily on the first embed call, then cached for the lifetime of
// the process. Use warmLocalEmbedPipeline() at server boot to pay the
// ~5-10 second cold-start cost up front so the first user query doesn't.
//
// Memory footprint: ~130 MB on disk, ~150-200 MB RAM resident. Render
// Standard (2 GB) has plenty of headroom but worth monitoring.

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'

const MODEL_ID = 'Xenova/bge-small-en-v1.5'
export const LOCAL_EMBEDDING_DIM = 384

let pipe: FeatureExtractionPipeline | null = null
let loadPromise: Promise<FeatureExtractionPipeline> | null = null

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (pipe) return pipe
  if (!loadPromise) {
    loadPromise = pipeline('feature-extraction', MODEL_ID, {
      quantized: true,
    })
      .then((p) => {
        pipe = p as FeatureExtractionPipeline
        console.log(
          `[embed] local pipeline ready (${MODEL_ID}, dim=${LOCAL_EMBEDDING_DIM})`,
        )
        return pipe
      })
      .catch((err) => {
        // Critical: clear loadPromise so the next call retries the
        // download instead of forever re-throwing the same rejection.
        // Without this, a single transient failure (network blip,
        // HuggingFace outage, etc.) at warm-up time would permanently
        // break the local embed pipeline until the process restarts.
        loadPromise = null
        throw err
      })
  }
  return loadPromise
}

/** Embed a single short text (query or chat message) with bge-small.
 *  Returns a 384-dim normalized vector ready to feed into pgvector
 *  cosine similarity search. */
export async function embedQueryLocal(text: string): Promise<number[]> {
  const p = await getPipeline()
  const output = await p(text, { pooling: 'mean', normalize: true })
  // Transformers.js returns a Tensor whose `.data` is a Float32Array.
  // pgvector wants a plain JS number[] (or a `[1.0,2.0,...]` literal).
  return Array.from(output.data as Float32Array)
}

/** Preload the model on server startup so the first user query doesn't
 *  pay the cold-start cost. Fire-and-forget — failures log but don't
 *  block boot since the lazy load path will retry on first embed call. */
export function warmLocalEmbedPipeline(): void {
  getPipeline().catch((err) => {
    console.error('[embed] failed to warm local pipeline:', (err as Error).message)
  })
}
