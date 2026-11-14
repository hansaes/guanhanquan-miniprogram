'use strict'
const { createHash } = require('node:crypto')
const { requireCondition } = require('./errors.cjs')

/**
 * Runs inside the caller's transaction, after actor revalidation and the shared
 * write lock. Failure rolls back both the effects and receipt. Successful receipts
 * are retained so delayed retries cannot charge again.
 * @template {object} T
 * @param {import('pg').PoolClient} client
 * @param {{ actor: string, operation: string, key: string, resource: string }} command
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
async function once(client, { actor, operation, key, resource }, work) {
  requireCondition(typeof key === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(key), 400, 'IDEMPOTENCY_KEY_REQUIRED', '请更新客户端后重试')
  const hash = createHash('sha256').update(JSON.stringify({ resource })).digest('hex')
  const existing = await client.query(
    'SELECT request_hash, result FROM command_receipts WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3',
    [actor, operation, key]
  )
  if (existing.rows[0]) {
    requireCondition(existing.rows[0].request_hash === hash, 409, 'IDEMPOTENCY_CONFLICT', '重复请求的参数不一致，请重新发起操作')
    return existing.rows[0].result
  }
  const result = await work()
  await client.query(
    'INSERT INTO command_receipts (actor_id, operation, idempotency_key, request_hash, result) VALUES ($1, $2, $3, $4, $5::jsonb)',
    [actor, operation, key, hash, JSON.stringify(result)]
  )
  return result
}

module.exports = { once }
