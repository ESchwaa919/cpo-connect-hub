import { runMigrations } from './server/db.ts'
import { createApp } from './server/app.ts'
import { syncMembersFromSheet } from './server/services/members.ts'
import { warmLocalEmbedPipeline } from './server/lib/embed.ts'

const app = createApp()
const PORT = process.env.PORT || 3001

async function start() {
  try {
    await runMigrations()
    console.log('Migrations complete')
  } catch (err) {
    console.warn('Migration warning (DB may not be available in dev):', (err as Error).message)
  }

  // Warm the local bge-small embedding pipeline in the background so
  // the first user query doesn't pay the ~5-10 second cold-start cost.
  // Fire-and-forget — failures log but don't block boot since the
  // lazy load path inside embedQueryLocal will retry on the first
  // call.
  warmLocalEmbedPipeline()

  // Best-effort member identity sync. Fire-and-forget so Sheets API
  // outages do not block startup — the cache stays empty until an
  // admin triggers a manual resync and the ingest/display paths fall
  // back to the legacy author_name column until then.
  syncMembersFromSheet()
    .then((r) =>
      console.log(
        `[startup] member sync ok: total=${r.totalRows} upserted=${r.upserted} phoneFailed=${r.phoneFailed}`,
      ),
    )
    .catch((err) =>
      console.error('[startup] member sync failed:', (err as Error).message),
    )

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`MAGIC_LINK_BASE_URL = ${process.env.MAGIC_LINK_BASE_URL}`)
    console.log(`SESSION_SECRET set = ${!!process.env.SESSION_SECRET}`)
    console.log(`NODE_ENV = ${process.env.NODE_ENV}`)
  })
}

start()
