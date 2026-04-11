// Testable core for the WhatsApp ingestion CLI. Injected deps let tests
// exercise parseArgs / runIngest / postIngestWithRetry without spawning
// a subprocess or hitting Gemini/Render. CLI wiring lives in
// scripts/ingest-whatsapp.ts.

import { basename } from 'node:path'
import {
  parseWhatsappChat,
  filterMonth,
} from './whatsapp-parser.ts'
import type {
  EmbedItem,
  EmbeddedItem,
} from './gemini-batch-embed.ts'
import { sleep } from './sleep.ts'

export interface ZipInput {
  zipPath: string
  channel: string
}

export interface CliArgs {
  zips: ZipInput[]
  month: string
  host: string
  timeZone: string
  dryRun: boolean
}

export interface IngestMessage {
  channel: string
  authorName: string
  messageText: string
  sentAt: string
  sourceExport: string
  embedding: number[]
}

export interface IngestPayload {
  month: string
  sourceExports: string[]
  messages: IngestMessage[]
}

export interface RunDeps {
  readZip: (zipPath: string) => string
  embed: (items: EmbedItem[]) => Promise<EmbeddedItem[]>
  post: (host: string, apiKey: string, payload: IngestPayload) => Promise<void>
}

export type ParseArgsResult =
  | { kind: 'args'; args: CliArgs }
  | { kind: 'help' }

/** Parse argv into a structured CliArgs, or a `help` marker when the
 *  caller passed -h/--help. Supports multiple `--zip`/`--channel` pairs;
 *  each `--zip` must be immediately followed by its matching `--channel`
 *  (other flags are allowed between pairs but not between a `--zip` and
 *  its channel). */
export function parseArgs(argv: string[]): ParseArgsResult {
  const zips: ZipInput[] = []
  let pendingZip: string | null = null
  let month: string | undefined
  let host: string | undefined
  let timeZone: string | undefined
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = (): string => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Missing value for ${a}`)
      return v
    }
    switch (a) {
      case '--zip':
        if (pendingZip !== null) {
          throw new Error(
            `--zip "${pendingZip}" has no matching --channel before the next --zip`,
          )
        }
        pendingZip = next()
        break
      case '--channel':
        if (pendingZip === null) {
          throw new Error('--channel must follow a matching --zip')
        }
        zips.push({ zipPath: pendingZip, channel: next() })
        pendingZip = null
        break
      case '--month':
        month = next()
        break
      case '--host':
        host = next()
        break
      case '--tz':
        timeZone = next()
        break
      case '--dry-run':
        dryRun = true
        break
      case '-h':
      case '--help':
        return { kind: 'help' }
      default:
        throw new Error(`Unknown argument: ${a}`)
    }
  }

  if (pendingZip !== null) {
    throw new Error(`--zip "${pendingZip}" has no matching --channel`)
  }
  if (zips.length === 0) {
    throw new Error('At least one --zip/--channel pair is required')
  }
  if (!month) throw new Error('--month is required (YYYY-MM)')
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`--month must be YYYY-MM (got ${month})`)
  }

  const resolvedHost = host ?? process.env.INGEST_HOST ?? 'http://localhost:3000'
  const resolvedTz = timeZone ?? process.env.INGEST_TZ ?? 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: resolvedTz })
  } catch {
    throw new Error(
      `--tz "${resolvedTz}" is not a valid IANA timezone (e.g. Europe/London)`,
    )
  }

  return {
    kind: 'args',
    args: {
      zips,
      month,
      host: resolvedHost,
      timeZone: resolvedTz,
      dryRun,
    },
  }
}

/** Parse every zip in order, filter to the run month, and produce
 *  partially-populated IngestMessage rows (embedding filled later). */
function parseAndTagAll(
  args: CliArgs,
  readZip: RunDeps['readZip'],
): IngestMessage[] {
  const rows: IngestMessage[] = []
  for (const zi of args.zips) {
    const sourceExport = basename(zi.zipPath)
    const raw = readZip(zi.zipPath)
    const parsed = parseWhatsappChat(raw, { timeZone: args.timeZone })
    const monthParsed = filterMonth(parsed, args.month)
    for (const m of monthParsed) {
      rows.push({
        channel: zi.channel,
        authorName: m.author,
        messageText: m.text,
        sentAt: m.sentAt,
        sourceExport,
        embedding: [],
      })
    }
  }
  return rows
}

export async function runIngest(
  args: CliArgs,
  ingestKey: string,
  deps: RunDeps,
  logger: Pick<Console, 'log'> = console,
): Promise<void> {
  const rows = parseAndTagAll(args, deps.readZip)
  const sourceExports = args.zips.map((z) => basename(z.zipPath))

  logger.log(
    `[ingest] Parsed ${rows.length} in-month messages from ${sourceExports.length} zip(s): ${sourceExports.join(', ')}`,
  )

  if (rows.length === 0) {
    logger.log('[ingest] Nothing to ingest — exiting')
    return
  }

  // Dry-run short-circuits BEFORE any paid embed calls or HTTP POST.
  if (args.dryRun) {
    logger.log(
      `[ingest] --dry-run: skipping Gemini embedding (saves paid API cost)`,
    )
    logger.log(`[ingest] --dry-run: skipping POST to /api/admin/chat/ingest`)
    logger.log(
      `[ingest] --dry-run: would send month=${args.month} sourceExports=[${sourceExports.join(',')}] messages=${rows.length}`,
    )
    return
  }

  logger.log(
    `[ingest] Embedding ${rows.length} messages sequentially via Gemini`,
  )
  const embedded = await deps.embed(
    rows.map((r, i) => ({ id: `${r.sourceExport}#${i}`, text: r.messageText })),
  )
  for (let i = 0; i < rows.length; i++) {
    rows[i].embedding = embedded[i].embedding
  }

  const payload: IngestPayload = {
    month: args.month,
    sourceExports,
    messages: rows,
  }

  logger.log(`[ingest] POSTing to ${args.host}/api/admin/chat/ingest`)
  await deps.post(args.host, ingestKey, payload)
  logger.log('[ingest] Done.')
}

interface PostIngestResult {
  runId: number
  ingested: number
  skipped: number
  durationMs: number
}

export interface PostIngestOptions {
  maxAttempts?: number
  /** Base backoff in ms; doubled each attempt (1×, 2×, 4×). Tests pass
   *  a small value so retry paths don't wait real seconds. */
  baseBackoffMs?: number
  fetchImpl?: typeof fetch
  logger?: Pick<Console, 'log'>
}

type AttemptOutcome =
  | { kind: 'success'; result: PostIngestResult }
  | { kind: 'client_error'; error: Error }
  | { kind: 'server_error'; error: Error }
  | { kind: 'network_error'; error: Error }

async function attemptPost(
  url: string,
  apiKey: string,
  payload: IngestPayload,
  fetchImpl: typeof fetch,
): Promise<AttemptOutcome> {
  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ingest-Key': apiKey,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    return { kind: 'network_error', error: err as Error }
  }

  if (res.ok) {
    const result = (await res.json()) as PostIngestResult
    return { kind: 'success', result }
  }

  const body = await res.text().catch(() => '')
  const error = new Error(
    `POST ${url} failed: ${res.status} ${res.statusText}\n${body}`,
  )
  if (res.status >= 400 && res.status < 500) {
    return { kind: 'client_error', error }
  }
  return { kind: 'server_error', error }
}

/** POST the ingest payload with capped retry on 5xx + network errors.
 *  4xx responses are NOT retried — client errors are the script's fault
 *  and retrying only wastes time. */
export async function postIngestWithRetry(
  host: string,
  apiKey: string,
  payload: IngestPayload,
  opts: PostIngestOptions = {},
): Promise<void> {
  const maxAttempts = opts.maxAttempts ?? 3
  const baseBackoffMs = opts.baseBackoffMs ?? 1000
  const fetchImpl = opts.fetchImpl ?? fetch
  const logger = opts.logger ?? console
  const url = `${host.replace(/\/$/, '')}/api/admin/chat/ingest`

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const outcome = await attemptPost(url, apiKey, payload, fetchImpl)

    if (outcome.kind === 'success') {
      const r = outcome.result
      logger.log(
        `[ingest] runId=${r.runId} ingested=${r.ingested} skipped=${r.skipped} durationMs=${r.durationMs}`,
      )
      return
    }

    if (outcome.kind === 'client_error') {
      throw outcome.error
    }

    lastError = outcome.error
    if (attempt < maxAttempts) {
      const wait = baseBackoffMs * Math.pow(2, attempt - 1)
      const kind = outcome.kind === 'server_error' ? 'server' : 'network'
      logger.log(
        `[ingest] POST ${kind} error (${outcome.error.message}), retrying in ${wait}ms (attempt ${attempt}/${maxAttempts})`,
      )
      await sleep(wait)
    }
  }
  throw lastError ?? new Error('postIngestWithRetry: exhausted attempts')
}
