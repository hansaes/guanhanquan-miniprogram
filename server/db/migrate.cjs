'use strict'

const { readFile, readdir } = require('node:fs/promises')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

async function migrate(pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', ['643276150102900'])
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    const files = (await readdir(__dirname)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()
    for (const file of files) {
      const sql = await readFile(join(__dirname, file), 'utf8')
      const checksum = createHash('sha256').update(sql).digest('hex')
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [file])
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error('Applied migration changed: ' + file)
        continue
      }
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)', [file, checksum])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

module.exports = { migrate }
