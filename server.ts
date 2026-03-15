import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigrations } from './server/db.ts'
import authRouter from './server/routes/auth.ts'
import membersRouter from './server/routes/members.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cookieParser())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Temporary debug endpoint — remove after data model research
app.get('/api/debug/sheet-schema', async (_req, res) => {
  try {
    const { google } = await import('googleapis')
    const raw = process.env.GOOGLE_SHEETS_CREDENTIALS
    if (!raw) { res.status(500).json({ error: 'No credentials' }); return }
    const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
    const sheets = google.sheets({ version: 'v4', auth })
    const sheetId = process.env.GOOGLE_SHEET_ID ?? '14DZ6Zp1UHg688FPTFdbJLCY6AXhgnAcnodV5KjVCAMs'

    // Get all sheet tab names
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties.title' })
    const tabNames = meta.data.sheets?.map(s => s.properties?.title) ?? []

    // Sheet1 headers + sample row (Erik)
    const s1 = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Sheet1' })
    const s1Rows = s1.data.values ?? []
    const s1Headers = s1Rows[0] ?? []
    const erikRow = s1Rows.find(r => r[3]?.toLowerCase() === 'eschwaa@gmail.com')

    // Directory headers + sample row
    const dir = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'PublicMemberDirectoryMVP' })
    const dirRows = dir.data.values ?? []
    const dirHeaders = dirRows[0] ?? []
    const dirSample = dirRows.length > 1 ? dirRows[1] : []

    res.json({ tabNames, sheet1: { headers: s1Headers, sampleRow: erikRow, rowCount: s1Rows.length - 1 }, directory: { headers: dirHeaders, sampleRow: dirSample, rowCount: dirRows.length - 1 } })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// API routes
app.use('/api/auth', authRouter)
app.use('/api/members', membersRouter)

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, 'dist')))

// SPA catch-all (Express 5 requires named wildcard parameter)
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// Start server
async function start() {
  try {
    await runMigrations()
    console.log('Migrations complete')
  } catch (err) {
    console.warn('Migration warning (DB may not be available in dev):', (err as Error).message)
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`MAGIC_LINK_BASE_URL = ${process.env.MAGIC_LINK_BASE_URL}`)
    console.log(`SESSION_SECRET set = ${!!process.env.SESSION_SECRET}`)
    console.log(`NODE_ENV = ${process.env.NODE_ENV}`)
  })
}

start()
