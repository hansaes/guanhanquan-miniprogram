'use strict'
const { randomUUID } = require('node:crypto')
const { requireCondition } = require('../../application/errors.cjs')

/** @param {import('pg').PoolClient} client @param {string} id @returns {Promise<import('../../application/types').JobRow>} */
async function getJob(client, id) {
  const result = await client.query('SELECT id, title, owner_openid, status, version, expire_at, request_top FROM jobs WHERE id = $1 FOR UPDATE', [id])
  requireCondition(result.rows[0], 404, 'JOB_NOT_FOUND', '招工信息不存在')
  return result.rows[0]
}

/** @param {import('pg').PoolClient} client @param {string} openid @param {string} title @param {string} content */
async function notify(client, openid, title, content) {
  await client.query(
    'INSERT INTO notifications (id, openid, title, content, type, is_read) VALUES ($1, $2, $3, $4, 2, false)',
    [randomUUID(), openid, title, content]
  )
}

module.exports = { getJob, notify }
