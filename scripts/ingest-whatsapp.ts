#!/usr/bin/env tsx
/**
 * Local WhatsApp ingestion CLI for WETA.
 *
 * Reads one or more WhatsApp iOS zip exports, parses `_chat.txt`, filters
 * to a given month, embeds each message via Gemini (sequentially), and
 * POSTs the result to /api/admin/chat/ingest with the `X-Ingest-Key`
 * header. Supports multiple `--zip`/`--channel` pairs in one run; each
 * message is tagged with its origin zip basename as `sourceExport`.
 *
 * Usage:
 *   npx tsx scripts/ingest-whatsapp.ts \
 *     --zip ./ai.zip          --channel ai \
 *     --zip ./general.zip     --channel general \
 *     --zip ./leadership.zip  --channel leadership_culture \
 *     --month 2026-04 \
 *     --tz Europe/London \
 *     [--host https://cpo-connect-hub.onrender.com] \
 *     [--dry-run]
 *
 * Environment (read from .env at repo root if present):
 *   INGEST_API_KEY   required — matches server-side value
 *   GEMINI_API_KEY   required — used by gemini-batch-embed
 *   INGEST_HOST      optional — default target host (overridden by --host)
 *   INGEST_TZ        optional — default timezone (overridden by --tz)
 */

import { readFileSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'
import AdmZip from 'adm-zip'
import {
  parseArgs,
  runIngest,
  postIngestWithRetry,
} from './lib/ingest-core.ts'
import { embedBatch } from './lib/gemini-batch-embed.ts'

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

function readZipChatTxt(zipPath: string): string {
  // Uses getData() only; never extractAll/extractEntryTo (path-traversal CVEs).
  const zip = new AdmZip(zipPath)
  const entry = zip.getEntries().find((e) => e.entryName.endsWith('_chat.txt'))
  if (!entry) {
    throw new Error(`No _chat.txt entry found in ${zipPath}`)
  }
  return entry.getData().toString('utf-8')
}

function printHelp(): void {
  console.log(`
Usage: npx tsx scripts/ingest-whatsapp.ts \\
  --zip <path> --channel <id> [--zip <path> --channel <id> ...] \\
  --month <YYYY-MM> [options]

Required:
  --zip <path>        Path to WhatsApp iOS zip export. May be repeated.
  --channel <id>      Channel id paired with the preceding --zip
                      (e.g. ai, general, leadership_culture). Must immediately
                      follow its matching --zip in argv order.
  --month <YYYY-MM>   Month to ingest; messages outside this window are dropped

Optional:
  --host <url>        Target host (default: INGEST_HOST env or http://localhost:3000)
  --tz <IANA name>    Timezone the export's wall-clock timestamps were
                      captured in (e.g. Europe/London). Default: UTC.
                      WhatsApp iOS exports do NOT include an offset, so
                      pass this if the exporting device is not in UTC.
  --dry-run           Parse only; skip both Gemini embeddings and the POST
  -h, --help          Show this help
`)
}

async function main(): Promise<void> {
  loadDotEnv()

  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.kind === 'help') {
    printHelp()
    return
  }
  const args = parsed.args

  const ingestKey = process.env.INGEST_API_KEY
  if (!ingestKey) {
    throw new Error(
      'INGEST_API_KEY is not set. Add it to .env (gitignored) before running.',
    )
  }
  // Only require GEMINI_API_KEY when we're actually going to embed.
  if (!args.dryRun && !process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to .env before running.')
  }

  await runIngest(args, ingestKey, {
    readZip: readZipChatTxt,
    embed: embedBatch,
    post: postIngestWithRetry,
  })
}

main().catch((err) => {
  console.error('[ingest] Failed:', (err as Error).message)
  process.exit(1)
})
