const { Pool } = require('pg')
const { loadConfig } = require('./config.cjs')
const { createDatabase } = require('./db/index.cjs')
const { migrate } = require('./db/migrate.cjs')
const { build } = require('./build.cjs')
const { seedReferenceData } = require('./seed.cjs')

async function main() {
  const config = loadConfig()
  const pool = new Pool({ connectionString: config.databaseUrl, max: 10, connectionTimeoutMillis: 5000 })
  pool.on('error', err => console.error('PostgreSQL connection error:', err.code || err.name))
  await migrate(pool)
  const db = createDatabase(pool)
  const app = await build({ config, pool, db, closePool: true, logger: { redact: ['req.headers.authorization', 'req.url'] } })
  await seedReferenceData(db)
  const shutdown = async () => { await app.close() }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  await app.listen({ host: config.host, port: config.port })
}
main().catch(err => { console.error('API startup failed:', err.message); process.exitCode = 1 })
