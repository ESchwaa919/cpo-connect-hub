import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || ''
  // Strip sslmode= parameter from the URL — we configure SSL separately
  return url.replace(/[?&]sslmode=[^&]*/g, '')
}

const pool = new pg.Pool({
  connectionString: getDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
})

export default pool

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    await pool.query(sql)
  }
}
