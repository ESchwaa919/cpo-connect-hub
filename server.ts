import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigrations } from './server/db.ts'
import authRouter from './server/routes/auth.ts'
import membersRouter from './server/routes/members.ts'
import { chatMemberRouter, chatAdminRouter } from './server/routes/chat.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cookieParser())

// The WETA monthly-ingest endpoint parses its body inside the admin router
// (after requireIngestAuth) with a much higher limit. Skip it here so the
// default ~100KB limit doesn't reject legitimate 5-15MB payloads, and so
// unauthenticated requests can't force pre-auth body-buffering of large
// bodies. Every other route uses the default parser.
const INGEST_PATH = '/api/admin/chat/ingest'
const defaultJsonParser = express.json()
app.use((req, res, next) => {
  if (req.path === INGEST_PATH) {
    next()
    return
  }
  defaultJsonParser(req, res, next)
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// API routes
app.use('/api/auth', authRouter)
app.use('/api/members', membersRouter)

// WETA chat endpoints. The ingest route's 50MB body parser is mounted
// INSIDE chatAdminRouter, after requireIngestAuth, so unauthenticated
// requests can't force pre-auth buffering of large bodies.
app.use('/api/chat', chatMemberRouter)
app.use('/api/admin/chat', chatAdminRouter)

// Service worker must not be cached by the browser
app.get('/sw.js', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Service-Worker-Allowed', '/')
  next()
})

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
