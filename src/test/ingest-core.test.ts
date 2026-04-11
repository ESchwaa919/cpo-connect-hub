import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseArgs,
  runIngest,
  postIngestWithRetry,
  type CliArgs,
  type IngestPayload,
  type RunDeps,
} from '../../scripts/lib/ingest-core'

function argsOf(argv: string[]): CliArgs {
  const r = parseArgs(argv)
  if (r.kind !== 'args') {
    throw new Error(`parseArgs returned ${r.kind}, expected args`)
  }
  return r.args
}

// -----------------------------------------------------------------------------
// parseArgs — multi-zip CLI surface
// -----------------------------------------------------------------------------

describe('parseArgs — multi-zip surface', () => {
  beforeEach(() => {
    delete process.env.INGEST_HOST
    delete process.env.INGEST_TZ
  })

  it('parses a single --zip/--channel pair (back-compat)', () => {
    const args = argsOf([
      '--zip', './ai.zip',
      '--channel', 'ai',
      '--month', '2026-04',
    ])
    expect(args.zips).toEqual([{ zipPath: './ai.zip', channel: 'ai' }])
    expect(args.month).toBe('2026-04')
    expect(args.dryRun).toBe(false)
    expect(args.timeZone).toBe('UTC')
  })

  it('parses multiple --zip/--channel pairs preserving order', () => {
    const args = argsOf([
      '--zip', './ai.zip',
      '--channel', 'ai',
      '--zip', './general.zip',
      '--channel', 'general',
      '--zip', './leadership.zip',
      '--channel', 'leadership_culture',
      '--month', '2026-04',
      '--tz', 'Europe/London',
    ])
    expect(args.zips).toEqual([
      { zipPath: './ai.zip', channel: 'ai' },
      { zipPath: './general.zip', channel: 'general' },
      { zipPath: './leadership.zip', channel: 'leadership_culture' },
    ])
    expect(args.timeZone).toBe('Europe/London')
  })

  it('throws when --zip has no matching --channel', () => {
    expect(() =>
      parseArgs(['--zip', './ai.zip', '--month', '2026-04']),
    ).toThrow(/no matching --channel/)
  })

  it('throws when --channel appears without a preceding --zip', () => {
    expect(() =>
      parseArgs(['--channel', 'ai', '--month', '2026-04']),
    ).toThrow(/--channel must follow/)
  })

  it('throws when two --zip flags appear without an intervening --channel', () => {
    expect(() =>
      parseArgs([
        '--zip', './ai.zip',
        '--zip', './general.zip',
        '--channel', 'general',
        '--month', '2026-04',
      ]),
    ).toThrow(/no matching --channel before the next --zip/)
  })

  it('throws when no --zip/--channel pair is supplied', () => {
    expect(() => parseArgs(['--month', '2026-04'])).toThrow(
      /At least one --zip\/--channel pair/,
    )
  })

  it('throws on malformed --month', () => {
    expect(() =>
      parseArgs([
        '--zip', './ai.zip',
        '--channel', 'ai',
        '--month', 'not-a-month',
      ]),
    ).toThrow(/YYYY-MM/)
  })

  it('returns { kind: "help" } on --help so the CLI wrapper can print help', () => {
    expect(parseArgs(['--help'])).toEqual({ kind: 'help' })
    expect(parseArgs(['-h'])).toEqual({ kind: 'help' })
  })

  it('rejects an invalid IANA timezone', () => {
    expect(() =>
      parseArgs([
        '--zip', './a.zip',
        '--channel', 'ai',
        '--month', '2026-04',
        '--tz', 'Bogus/NotAZone',
      ]),
    ).toThrow(/not a valid IANA timezone/)
  })
})

// -----------------------------------------------------------------------------
// runIngest — orchestration: dry-run short-circuit + multi-zip tagging
// -----------------------------------------------------------------------------

function makeDeps(overrides: Partial<RunDeps> = {}): {
  deps: RunDeps
  readZipMock: ReturnType<typeof vi.fn>
  embedMock: ReturnType<typeof vi.fn>
  postMock: ReturnType<typeof vi.fn>
} {
  const readZipMock = vi.fn()
  const embedMock = vi.fn().mockImplementation(async (items) =>
    items.map((it: { id: string; text: string }) => ({
      ...it,
      embedding: new Array(768).fill(0.1),
    })),
  )
  const postMock = vi.fn().mockResolvedValue(undefined)
  return {
    deps: {
      readZip: readZipMock,
      embed: embedMock,
      post: postMock,
      ...overrides,
    },
    readZipMock,
    embedMock,
    postMock,
  }
}

function baseArgs(partial: Partial<CliArgs> = {}): CliArgs {
  return {
    zips: [{ zipPath: './ai.zip', channel: 'ai' }],
    month: '2026-03',
    host: 'http://localhost:3000',
    timeZone: 'UTC',
    dryRun: false,
    ...partial,
  }
}

const silent: Pick<Console, 'log'> = { log: () => {} }

describe('runIngest — dry-run short-circuit', () => {
  it('does NOT call embed or post when dryRun is true', async () => {
    const { deps, readZipMock, embedMock, postMock } = makeDeps()
    readZipMock.mockReturnValue(
      '[05/03/2026, 14:23:11] Alice: hello from ai',
    )
    await runIngest(
      baseArgs({ dryRun: true }),
      'test-ingest-key',
      deps,
      silent,
    )
    expect(readZipMock).toHaveBeenCalledTimes(1)
    expect(embedMock).not.toHaveBeenCalled()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('short-circuits when no messages match the month (no embed, no post)', async () => {
    const { deps, readZipMock, embedMock, postMock } = makeDeps()
    readZipMock.mockReturnValue(
      '[05/01/2026, 14:23:11] Alice: outside window',
    )
    await runIngest(baseArgs(), 'test-ingest-key', deps, silent)
    expect(embedMock).not.toHaveBeenCalled()
    expect(postMock).not.toHaveBeenCalled()
  })
})

describe('runIngest — multi-zip orchestration', () => {
  it('tags each message with its origin zip basename as sourceExport', async () => {
    const { deps, readZipMock, embedMock, postMock } = makeDeps()
    readZipMock.mockImplementation((zipPath: string) => {
      if (zipPath === './ai.zip') {
        return [
          '[05/03/2026, 14:23:11] Alice: ai-one',
          '[05/03/2026, 14:24:00] Bob: ai-two',
        ].join('\n')
      }
      if (zipPath === './general.zip') {
        return '[06/03/2026, 09:15:00] Carol: gen-one'
      }
      throw new Error(`Unexpected readZip path: ${zipPath}`)
    })

    await runIngest(
      baseArgs({
        zips: [
          { zipPath: './ai.zip', channel: 'ai' },
          { zipPath: './general.zip', channel: 'general' },
        ],
      }),
      'test-ingest-key',
      deps,
      silent,
    )

    expect(readZipMock).toHaveBeenCalledTimes(2)
    expect(embedMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledTimes(1)

    const payload = postMock.mock.calls[0][2] as IngestPayload
    expect(payload.month).toBe('2026-03')
    expect(payload.sourceExports).toEqual(['ai.zip', 'general.zip'])
    expect(payload.messages).toHaveLength(3)

    expect(payload.messages[0]).toMatchObject({
      channel: 'ai',
      authorName: 'Alice',
      messageText: 'ai-one',
      sourceExport: 'ai.zip',
    })
    expect(payload.messages[1]).toMatchObject({
      channel: 'ai',
      authorName: 'Bob',
      sourceExport: 'ai.zip',
    })
    expect(payload.messages[2]).toMatchObject({
      channel: 'general',
      authorName: 'Carol',
      sourceExport: 'general.zip',
    })
    // Every message carries a 768-dim embedding from the mock.
    for (const m of payload.messages) {
      expect(m.embedding).toHaveLength(768)
    }
  })

  it('passes the ingest key as the second arg to post', async () => {
    const { deps, readZipMock, postMock } = makeDeps()
    readZipMock.mockReturnValue('[05/03/2026, 14:23:11] Alice: hi')
    await runIngest(baseArgs(), 'the-secret-key', deps, silent)
    expect(postMock.mock.calls[0][1]).toBe('the-secret-key')
  })
})

// -----------------------------------------------------------------------------
// postIngestWithRetry — retry/backoff semantics
// -----------------------------------------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status })
}

const successBody = {
  runId: 42,
  ingested: 3,
  skipped: 0,
  durationMs: 123,
}

const samplePayload: IngestPayload = {
  month: '2026-03',
  sourceExports: ['ai.zip'],
  messages: [],
}

describe('postIngestWithRetry — retry on 5xx', () => {
  it('retries on 500 twice then succeeds on the third attempt', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(500, 'boom one'))
      .mockResolvedValueOnce(textResponse(500, 'boom two'))
      .mockResolvedValueOnce(jsonResponse(200, successBody))

    await postIngestWithRetry(
      'http://localhost:3000',
      'test-key',
      samplePayload,
      { fetchImpl: fetchMock, baseBackoffMs: 1, maxAttempts: 3, logger: silent },
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws after max attempts when every response is 5xx', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(textResponse(503, 'still broken'))

    await expect(
      postIngestWithRetry(
        'http://localhost:3000',
        'test-key',
        samplePayload,
        { fetchImpl: fetchMock, baseBackoffMs: 1, maxAttempts: 3, logger: silent },
      ),
    ).rejects.toThrow(/503/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does NOT retry on 4xx client errors', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(400, 'bad month'))

    await expect(
      postIngestWithRetry(
        'http://localhost:3000',
        'test-key',
        samplePayload,
        { fetchImpl: fetchMock, baseBackoffMs: 1, maxAttempts: 3, logger: silent },
      ),
    ).rejects.toThrow(/400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on network errors (thrown by fetch) up to maxAttempts', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce(jsonResponse(200, successBody))

    await postIngestWithRetry(
      'http://localhost:3000',
      'test-key',
      samplePayload,
      { fetchImpl: fetchMock, baseBackoffMs: 1, maxAttempts: 3, logger: silent },
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('succeeds on the first attempt without retrying', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(200, successBody))

    await postIngestWithRetry(
      'http://localhost:3000',
      'test-key',
      samplePayload,
      { fetchImpl: fetchMock, baseBackoffMs: 1, maxAttempts: 3, logger: silent },
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
