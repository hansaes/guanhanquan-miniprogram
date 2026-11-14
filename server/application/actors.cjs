'use strict'
const { requireCondition } = require('./errors.cjs')

/** @param {import('pg').PoolClient} client @param {import('./types').Actor} actor */
async function requireUser(client, actor) {
  requireCondition(actor.openid, 401, 'AUTH_REQUIRED', '请先登录')
  const result = await client.query('SELECT id, openid, nickname, phone, status FROM users WHERE openid = $1', [actor.openid])
  requireCondition(result.rows[0] && Number(result.rows[0].status) === 0, 401, 'AUTH_REQUIRED', '登录已失效，请重新登录')
  return /** @type {import('./types').UserRow} */ (result.rows[0])
}

/** @param {import('pg').PoolClient} client @param {import('./types').Actor} actor */
async function requireAdmin(client, actor) {
  requireCondition(actor.admin, 401, 'ADMIN_REQUIRED', '请先登录管理后台')
  const admin = actor.admin
  if (!admin) throw new Error('Missing admin identity')
  const result = await client.query(
    "SELECT id FROM admins WHERE id = $1 AND username = $2 AND enabled = true AND role = 'super'",
    [admin.adminId, admin.username]
  )
  requireCondition(result.rowCount === 1, 401, 'ADMIN_REQUIRED', '管理员会话已失效')
  return admin
}

module.exports = { requireUser, requireAdmin }
