const { Pool } = require('pg')
const { migrate } = require('../db/migrate.cjs')
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try { await migrate(pool); console.log('PostgreSQL migrations complete') } finally { await pool.end() }
}
main().catch(err => { console.error(err.message); process.exitCode = 1 })
