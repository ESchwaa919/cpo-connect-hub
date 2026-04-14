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

// Regression test for the codex pass-1 finding: getPipeline()'s
// loadPromise must clear on rejection so a transient model-load
// failure can be retried on the next call. Without the .catch reset,
// a single network blip during warmLocalEmbedPipeline() would
// permanently 503 the local embed path until the process restarts.
//
// We can't easily simulate a failed pipeline() call against the real
// model, so this test proves the unit-level recovery shape: we mock
// the @xenova/transformers pipeline export, force the first call to
// reject, then assert the second call triggers a fresh pipeline()
// invocation and resolves successfully.
import { vi } from 'vitest'

const slowOrSkip = process.env.SKIP_SLOW_TESTS ? describe.skip : describe

slowOrSkip('embed pipeline retry on transient failure', () => {
  it('clears loadPromise on rejection so the next call retries', async () => {
    vi.resetModules()
    const pipelineMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(async () => ({
        data: new Float32Array(384).fill(0.05),
      }))

    vi.doMock('@xenova/transformers', () => ({
      pipeline: pipelineMock,
    }))

    const { embedQueryLocal } = await import('../../server/lib/embed')
    await expect(embedQueryLocal('first attempt')).rejects.toThrow(
      'network blip',
    )
    // Second call must trigger a fresh pipeline() invocation, NOT
    // re-throw the cached rejection.
    const vec = await embedQueryLocal('second attempt')
    expect(vec).toHaveLength(384)
    expect(pipelineMock).toHaveBeenCalledTimes(2)

    vi.doUnmock('@xenova/transformers')
    vi.resetModules()
  })
})
