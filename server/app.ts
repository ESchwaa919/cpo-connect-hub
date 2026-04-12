import express, { type Application } from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import authRouter from './routes/auth.ts'
import membersRouter from './routes/members.ts'
import { chatMemberRouter, chatAdminRouter } from './routes/chat.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INGEST_PATH = '/api/admin/chat/ingest'

/** Builds the Express app with every middleware + router mounted.
 *  Shared between server.ts (production entry) and integration tests
 *  so tests exercise the exact same mount order and middleware chain
 *  that production uses.
 *
 *  Does NOT call `app.listen()` or run migrations — callers own lifecycle. */
export function createApp(options: { serveStatic?: boolean } = {}): Application {
  const { serveStatic = true } = options

  const app = express()

  app.use(cookieParser())

  // The WETA monthly-ingest endpoint parses its body inside the admin router
  // (after requireIngestAuth) with a much higher limit. Skip it here so the
  // default ~100KB limit doesn't reject legitimate 5-15MB payloads, and so
  // unauthenticated requests can't force pre-auth body-buffering of large
  // bodies. Every other route uses the default parser.
  const defaultJsonParser = express.json()
  app.use((req, res, next) => {
    if (req.path === INGEST_PATH) {
      next()
      return
    }
    defaultJsonParser(req, res, next)
  })

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/members', membersRouter)

  // WETA chat endpoints. The ingest route's 50MB body parser is mounted
  // INSIDE chatAdminRouter, after requireIngestAuth, so unauthenticated
  // requests can't force pre-auth buffering of large bodies.
  app.use('/api/chat', chatMemberRouter)
  app.use('/api/admin/chat', chatAdminRouter)

  if (serveStatic) {
    app.get('/sw.js', (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Service-Worker-Allowed', '/')
      next()
    })

    app.use(express.static(path.join(__dirname, '..', 'dist')))

    // SPA catch-all (Express 5 requires named wildcard parameter)
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'))
    })
  }

  return app
}
