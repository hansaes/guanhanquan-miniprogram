'use strict'
const { randomUUID } = require('node:crypto')
const { requireCondition } = require('../../application/errors.cjs')

/** @param {import('pg').PoolClient} client @param {string} key @param {number} fallback @param {number} min @param {number} max */
async function integerSetting(client, key, fallback, min, max) {
  const result = await client.query('SELECT value FROM configs WHERE key = $1', [key])
  const value = result.rows[0] ? Number(result.rows[0].value) : fallback
  requireCondition(Number.isSafeInteger(value) && value >= min && value <= max, 409, 'INVALID_FEE_CONFIG', '费用配置不合法，请联系管理员')
  return value
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{openid: string, asset: 'points'|'balance', units: number, businessType: string, businessId: string, remark: string}} charge
 * @returns {Promise<boolean>}
 */
async function debit(client, { openid, asset, units, businessType, businessId, remark }) {
  requireCondition(Number.isSafeInteger(units) && units >= 0, 409, 'INVALID_AMOUNT', '扣费金额不合法')
  // Money is passed as integer cents; conversion is performed by PostgreSQL numeric.
  const field = asset === 'points' ? 'points' : 'balance'
  const amount = asset === 'points' ? '$2::bigint' : '($2::numeric / 100)'
  const updated = await client.query(
    `UPDATE users SET ${field} = ${field} - ${amount}, updated_at = now()
     WHERE openid = $1 AND status = 0 AND ${field} >= ${amount} RETURNING id`, [openid, units]
  )
  if (!updated.rowCount) return false
  await client.query(
    `INSERT INTO wallet (id, openid, type, amount, business_type, business_id, remark)
     VALUES ($1, $2, $3, -($4::numeric / $5), $6, $7, $8)`,
    [randomUUID(), openid, asset === 'points' ? 2 : 4, units, asset === 'points' ? 1 : 100, businessType, businessId, remark]
  )
  return true
}

/** @param {string} decimal */
function moneyToCents(decimal) {
  requireCondition(/^\d+(\.\d{1,2})?$/.test(decimal), 409, 'INVALID_PRICE', '保险价格配置不合法')
  const [whole, fraction = ''] = decimal.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  requireCondition(Number.isSafeInteger(cents) && cents >= 0 && cents <= 100000000, 409, 'INVALID_PRICE', '保险价格配置不合法')
  return cents
}

module.exports = { debit, integerSetting, moneyToCents }
