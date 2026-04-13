import { runMigrations } from './server/db.ts'
import { createApp } from './server/app.ts'
import { syncMembersFromSheet } from './server/services/members.ts'

const app = createApp()
const PORT = process.env.PORT || 3001

async function start() {
  try {
    await runMigrations()
    console.log('Migrations complete')
  } catch (err) {
    console.warn('Migration warning (DB may not be available in dev):', (err as Error).message)
  }

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
