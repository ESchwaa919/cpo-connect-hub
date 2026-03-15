import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigrations } from './server/db.ts'

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

// API route mounts (added in later tasks)
// app.use('/api/auth', authRouter)
// app.use('/api/members', membersRouter)

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, 'dist')))

// SPA catch-all
app.get('*', (_req, res) => {
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
  })
}

start()
