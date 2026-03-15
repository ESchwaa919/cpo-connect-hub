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
  const migrationPath = path.join(__dirname, 'migrations', '001-init.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')
  await pool.query(sql)
}
