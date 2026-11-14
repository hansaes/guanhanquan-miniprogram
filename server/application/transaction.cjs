'use strict'
const { LEGACY_WRITE_LOCK } = require('../db/transaction-lock.cjs')

/**
 * @template T
 * @param {import('pg').Pool} pool
 * @param {(client: import('pg').PoolClient) => Promise<T>} work
 * @param {{ readOnly?: boolean }} [options]
 * @returns {Promise<T>}
 */
async function transaction(pool, work, { readOnly = false } = {}) {
  const client = await pool.connect()
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN')
    if (!readOnly) await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [LEGACY_WRITE_LOCK])
    const result = await work(client)
    const committed = await client.query('COMMIT')
    if (committed.command !== 'COMMIT') throw new Error('Transaction was rolled back')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

module.exports = { transaction }
