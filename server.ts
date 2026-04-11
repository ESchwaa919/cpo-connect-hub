import { runMigrations } from './server/db.ts'
import { createApp } from './server/app.ts'

const app = createApp()
const PORT = process.env.PORT || 3001

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
