// Side-effect-only module. Imported before `server/db` so DATABASE_URL and
// SESSION_SECRET are loaded from .env, and DATABASE_URL is normalized,
// before pg.Pool is constructed.
//
// Why this exists:
//  1. vitest does not auto-load .env, so the test process starts without
//     DATABASE_URL / SESSION_SECRET unless the parent shell exported them.
//  2. server/db.ts strips `sslmode=` from DATABASE_URL via a regex. If
//     sslmode is NOT the last query param, the strip leaves a malformed
//     URL (e.g. `/db&search_path=x`). Pre-reorder sslmode to the end of
//     the query string using the WHATWG URL parser so the downstream
//     strip produces a well-formed URL.
import { readFileSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'

try {
  const envPath = pathResolve(process.cwd(), '.env')
  const contents = readFileSync(envPath, 'utf-8')
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(trimmed)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2]
    }
  }
} catch {
  /* .env missing — cookie-path tests will skip */
}

if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL)
    if (url.searchParams.has('sslmode')) {
      const mode = url.searchParams.get('sslmode') ?? ''
      url.searchParams.delete('sslmode')
      url.searchParams.append('sslmode', mode)
      process.env.DATABASE_URL = url.toString()
    }
  } catch {
    /* Invalid URL — test's skipIf will catch this downstream */
  }
}
