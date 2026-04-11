#!/usr/bin/env tsx
/**
 * Local WhatsApp ingestion script for WETA (What's Everyone Talking About).
 *
 * Reads a WhatsApp iOS zip export, parses `_chat.txt`, filters to a given
 * month, embeds each message via Gemini (sequentially), and POSTs the
 * result to /api/admin/chat/ingest with the `X-Ingest-Key` header.
 *
 * Usage:
 *   npx tsx scripts/ingest-whatsapp.ts \
 *     --zip ./exports/ai-channel-2026-03.zip \
 *     --channel ai \
 *     --month 2026-03 \
 *     [--host https://cpo-connect-hub.onrender.com] \
 *     [--dry-run]
 *
 * Environment (read from .env at repo root if present):
 *   INGEST_API_KEY   required — matches server-side value
 *   GEMINI_API_KEY   required — used by gemini-batch-embed
 *   INGEST_HOST      optional — default target host (overridden by --host)
 */

import { readFileSync } from 'node:fs'
import { resolve as pathResolve, basename } from 'node:path'
import AdmZip from 'adm-zip'
import {
  parseWhatsappChat,
  filterMonth,
} from './lib/whatsapp-parser.ts'
import { embedBatch } from './lib/gemini-batch-embed.ts'

interface CliArgs {
  zip: string
  channel: string
  month: string
  host: string
  timeZone: string
  dryRun: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = { dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Missing value for ${a}`)
      return v
    }
    switch (a) {
      case '--zip':
        args.zip = next()
        break
      case '--channel':
        args.channel = next()
        break
      case '--month':
        args.month = next()
        break
      case '--host':
        args.host = next()
        break
      case '--tz':
        args.timeZone = next()
        break
      case '--dry-run':
        args.dryRun = true
        break
      case '-h':
      case '--help':
        printHelpAndExit(0)
        break
      default:
        throw new Error(`Unknown argument: ${a}`)
    }
  }
  if (!args.zip) throw new Error('--zip is required')
  if (!args.channel) throw new Error('--channel is required')
  if (!args.month) throw new Error('--month is required (YYYY-MM)')
  if (!/^\d{4}-\d{2}$/.test(args.month)) {
    throw new Error(`--month must be YYYY-MM (got ${args.month})`)
  }
  args.host =
    args.host ?? process.env.INGEST_HOST ?? 'http://localhost:3000'
  args.timeZone = args.timeZone ?? process.env.INGEST_TZ ?? 'UTC'
  // Fail fast on bad tz rather than silently producing wrong UTC instants.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: args.timeZone })
  } catch {
    throw new Error(
      `--tz "${args.timeZone}" is not a valid IANA timezone (e.g. Europe/London)`,
    )
  }
  return args as CliArgs
}

function printHelpAndExit(code: number): never {
  console.log(`
Usage: npx tsx scripts/ingest-whatsapp.ts --zip <path> --channel <id> --month <YYYY-MM> [options]

Required:
  --zip <path>        Path to WhatsApp iOS zip export
  --channel <id>      Channel identifier (e.g. ai, general, leadership_culture)
  --month <YYYY-MM>   Month to ingest; messages outside this window are dropped

Optional:
  --host <url>        Target host (default: INGEST_HOST env or http://localhost:3000)
  --tz <IANA name>    Timezone the export's wall-clock timestamps were
                      captured in (e.g. Europe/London). Default: UTC.
                      WhatsApp iOS exports do NOT include an offset, so
                      pass this if the exporting device is not in UTC.
  --dry-run           Parse + embed but skip the HTTP POST
  -h, --help          Show this help
`)
  process.exit(code)
}

function loadDotEnv(): void {
  try {
    const envPath = pathResolve(process.cwd(), '.env')
    const contents = readFileSync(envPath, 'utf-8')
    for (const line of contents.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(trimmed)
      if (!m || process.env[m[1]]) continue
      let value = m[2]
      // Strip unquoted trailing "# comment" (space-prefixed hash).
      const commentIdx = value.search(/\s+#/)
      if (commentIdx >= 0) value = value.slice(0, commentIdx)
      value = value.trim().replace(/^"(.*)"$/, '$1')
      process.env[m[1]] = value
    }
  } catch {
    /* .env missing — script will fail at the env-var check below */
  }
}

function extractChatTxt(zipPath: string): string {
  // Safety: only `getData()` is ever called on zip entries — we read the
  // chat text into a Buffer in memory and never touch the filesystem.
  // adm-zip's historical path-traversal CVEs all live in extractAll /
  // extractEntryTo, neither of which is used here. Do not switch to those.
  const zip = new AdmZip(zipPath)
  const entry = zip.getEntries().find((e) => e.entryName.endsWith('_chat.txt'))
  if (!entry) {
    throw new Error(`No _chat.txt entry found in ${zipPath}`)
  }
  return entry.getData().toString('utf-8')
}

interface IngestPayload {
  month: string
  sourceExports: string[]
  messages: Array<{
    channel: string
    authorName: string
    messageText: string
    sentAt: string
    sourceExport: string
    embedding: number[]
  }>
}

async function postIngest(
  host: string,
  apiKey: string,
  payload: IngestPayload,
): Promise<void> {
  const url = `${host.replace(/\/$/, '')}/api/admin/chat/ingest`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ingest-Key': apiKey,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText}\n${body}`)
  }
  const result = (await res.json()) as {
    runId: number
    ingested: number
    skipped: number
    durationMs: number
  }
  console.log(
    `[ingest] runId=${result.runId} ingested=${result.ingested} skipped=${result.skipped} durationMs=${result.durationMs}`,
  )
}

async function main(): Promise<void> {
  loadDotEnv()
  const args = parseArgs(process.argv.slice(2))

  const ingestKey = process.env.INGEST_API_KEY
  if (!ingestKey) {
    throw new Error(
      'INGEST_API_KEY is not set. Add it to .env (gitignored) before running.',
    )
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to .env before running.')
  }

  console.log(`[ingest] Reading ${args.zip}`)
  const rawChat = extractChatTxt(args.zip)

  console.log(`[ingest] Parsing WhatsApp export (timezone: ${args.timeZone})`)
  const parsed = parseWhatsappChat(rawChat, { timeZone: args.timeZone })
  const monthMessages = filterMonth(parsed, args.month)
  console.log(
    `[ingest] Parsed ${parsed.length} messages total, ${monthMessages.length} in month ${args.month}`,
  )
  if (monthMessages.length === 0) {
    console.log('[ingest] Nothing to ingest — exiting')
    return
  }

  const sourceExport = basename(args.zip)
  console.log(
    `[ingest] Embedding ${monthMessages.length} messages sequentially via Gemini`,
  )
  const embedded = await embedBatch(
    monthMessages.map((m, i) => ({
      id: `${sourceExport}#${i}`,
      text: m.text,
    })),
  )

  const payload: IngestPayload = {
    month: args.month,
    sourceExports: [sourceExport],
    messages: monthMessages.map((m, i) => ({
      channel: args.channel,
      authorName: m.author,
      messageText: m.text,
      sentAt: m.sentAt,
      sourceExport,
      embedding: embedded[i].embedding,
    })),
  }

  if (args.dryRun) {
    console.log(
      `[ingest] --dry-run: skipping POST (${payload.messages.length} messages prepared)`,
    )
    return
  }

  console.log(`[ingest] POSTing to ${args.host}/api/admin/chat/ingest`)
  await postIngest(args.host, ingestKey, payload)
  console.log('[ingest] Done.')
}

main().catch((err) => {
  console.error('[ingest] Failed:', (err as Error).message)
  process.exit(1)
})
