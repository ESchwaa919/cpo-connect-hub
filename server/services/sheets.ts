import { google } from 'googleapis'

const SHEET_ID =
  process.env.GOOGLE_SHEET_ID ?? '14DZ6Zp1UHg688FPTFdbJLCY6AXhgnAcnodV5KjVCAMs'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function getAuthClient() {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS
  if (!raw) {
    throw new Error('GOOGLE_SHEETS_CREDENTIALS env var is not set')
  }
  const credentials = JSON.parse(
    Buffer.from(raw, 'base64').toString('utf-8')
  ) as object

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  return auth
}

// ---------------------------------------------------------------------------
// Lazy Sheets client
// ---------------------------------------------------------------------------

let _sheetsClient: ReturnType<typeof google.sheets> | null = null

function getSheetsClient() {
  if (!_sheetsClient) {
    _sheetsClient = google.sheets({ version: 'v4', auth: getAuthClient() })
  }
  return _sheetsClient
}

// ---------------------------------------------------------------------------
// Generic cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

function makeCache<T>() {
  let entry: CacheEntry<T> | null = null

  return {
    get(): T | null {
      if (entry && Date.now() < entry.expiresAt) return entry.data
      return null
    },
    set(data: T) {
      entry = { data, expiresAt: Date.now() + CACHE_TTL_MS }
    },
  }
}

// ---------------------------------------------------------------------------
// Sheet1 helpers — member lookup
// ---------------------------------------------------------------------------

type SheetRow = string[]

interface Sheet1Cache {
  headers: string[]
  rows: SheetRow[]
}

export interface MemberRecord {
  email: string
  name: string
  status: string
  jobRole: string
}

const sheet1Cache = makeCache<Sheet1Cache>()

async function fetchSheet1(): Promise<Sheet1Cache> {
  const cached = sheet1Cache.get()
  if (cached) return cached

  const sheets = getSheetsClient()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1',
  })

  const values = (response.data.values ?? []) as SheetRow[]
  const headers = values[0] ?? []
  const rows = values.slice(1)

  const result: Sheet1Cache = { headers, rows }
  sheet1Cache.set(result)
  return result
}

function colIndex(headers: string[], name: string): number {
  return headers.findIndex(
    (h) => h.trim().toLowerCase() === name.trim().toLowerCase()
  )
}

export async function lookupMember(email: string): Promise<MemberRecord | null> {
  const { headers, rows } = await fetchSheet1()

  const emailCol = colIndex(headers, 'Email')
  const nameCol = colIndex(headers, 'Full Name')
  const statusCol = colIndex(headers, 'Status')
  const jobRoleCol = colIndex(headers, 'Job Role')

  if (emailCol === -1) {
    console.error('[sheets] No "Email" column found in headers:', headers)
    throw new Error('Sheet1 is missing an "Email" column')
  }

  const normalised = email.trim().toLowerCase()

  for (const row of rows) {
    const rowEmail = (row[emailCol] ?? '').trim().toLowerCase()
    if (rowEmail === normalised) {
      const result = {
        email: row[emailCol] ?? '',
        name: nameCol !== -1 ? (row[nameCol] ?? '') : '',
        status: statusCol !== -1 ? (row[statusCol] ?? '') : '',
        jobRole: jobRoleCol !== -1 ? (row[jobRoleCol] ?? '') : '',
      }
      return result
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// PublicMemberDirectoryMVP helpers
// ---------------------------------------------------------------------------

export type DirectoryEntry = Record<string, string>

const directoryCache = makeCache<DirectoryEntry[]>()

export async function getDirectory(): Promise<DirectoryEntry[]> {
  const cached = directoryCache.get()
  if (cached) return cached

  try {
    const sheets = getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'PublicMemberDirectoryMVP',
    })

    const values = (response.data.values ?? []) as SheetRow[]
    if (values.length === 0) {
      directoryCache.set([])
      return []
    }

    const headers = values[0] ?? []
    const rows = values.slice(1)

    const entries: DirectoryEntry[] = rows.map((row) => {
      const entry: DirectoryEntry = {}
      headers.forEach((header, i) => {
        entry[header] = row[i] ?? ''
      })
      return entry
    })

    directoryCache.set(entries)
    return entries
  } catch (err) {
    console.error('getDirectory: Sheets API error —', (err as Error).message)
    return []
  }
}
