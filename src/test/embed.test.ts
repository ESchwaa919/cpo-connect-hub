// @vitest-environment node
//
// Real-model test for the local bge-small embed pipeline. MUST run
// in the `node` environment, NOT jsdom — onnxruntime-common does an
// `instanceof Float32Array` identity check on tensor data, and
// jsdom substitutes its own Float32Array constructor which fails
// the check at runtime. In production (server/embed.ts) we always
// run on Node, so the production behavior is correct; this directive
// just makes the test environment match.
//
// SLOW: the first run downloads the ~130 MB model from HuggingFace
// and caches it on disk. Subsequent runs are fast (~50ms). Skipped
// by default when SKIP_SLOW_TESTS=1 (CI / quick local runs); run
// explicitly with `npx vitest run src/test/embed.test.ts` to verify
// the pipeline still works end-to-end after a dep upgrade or model
// switch.
import { describe, it, expect } from 'vitest'

const slowDescribe = process.env.SKIP_SLOW_TESTS ? describe.skip : describe

slowDescribe('embedQueryLocal (real bge-small model)', () => {
  it('returns a 384-dim normalized vector for a non-trivial query', async () => {
    const { embedQueryLocal, LOCAL_EMBEDDING_DIM } = await import(
      '../../server/lib/embed'
    )
    const vec = await embedQueryLocal(
      'What is the community saying about Claude Code?',
    )
    expect(vec).toHaveLength(LOCAL_EMBEDDING_DIM)
    expect(LOCAL_EMBEDDING_DIM).toBe(384)
    // Normalized → magnitude ~= 1
    const magnitude = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
    expect(magnitude).toBeGreaterThan(0.95)
    expect(magnitude).toBeLessThan(1.05)
    // No NaN / Infinity
    for (const x of vec) {
      expect(Number.isFinite(x)).toBe(true)
    }
  }, 30_000) // first-run download budget

  it('produces deterministic output for the same input', async () => {
    const { embedQueryLocal } = await import('../../server/lib/embed')
    const a = await embedQueryLocal('hello world')
    const b = await embedQueryLocal('hello world')
    expect(a).toEqual(b)
  })

  it('produces different output for different inputs', async () => {
    const { embedQueryLocal } = await import('../../server/lib/embed')
    const a = await embedQueryLocal('What is product management?')
    const b = await embedQueryLocal('How do I write a SQL join?')
    // Cosine similarity between two unrelated queries should be well
    // below 0.9 (they're normalized so cosine = dot product).
    let dot = 0
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
    expect(dot).toBeLessThan(0.9)
  })
})
