'use strict'
const { transaction } = require('../../application/transaction.cjs')
const { requireAdmin } = require('../../application/actors.cjs')

/** @param {{pool: import('pg').Pool}} dependencies */
function createFinanceService({ pool }) {
  return {
    /** @param {import('../../application/types').Actor} actor @param {{page?: string, pageSize?: string}} input @returns {Promise<import('../../../contracts/architecture-v1').FinanceResult>} */
    async report(actor, input) {
      return transaction(pool, async client => {
        await requireAdmin(client, actor)
        const page = Number(input.page || 1)
        const pageSize = Number(input.pageSize || 20)
        const snapshot = await client.query('SELECT transaction_timestamp() AS at')
        const totals = (await client.query(`SELECT count(*) AS total,
          COALESCE(sum(-amount) FILTER (WHERE type = 2 AND amount < 0), 0) AS points,
          COALESCE(sum(-amount) FILTER (WHERE type = 4 AND amount < 0), 0) AS balance FROM wallet`)).rows[0]
        const orders = (await client.query("SELECT count(*) AS total, COALESCE(sum(amount), 0) AS amount FROM orders WHERE status = 'paid'")).rows[0]
        const business = await client.query(`SELECT business_type, type, sum(-amount) AS amount FROM wallet
          WHERE amount < 0 AND type IN (2, 4) GROUP BY business_type, type ORDER BY amount DESC, business_type, type`)
        const rows = await client.query(`SELECT id, openid, type, amount, business_type, remark, created_at FROM wallet
          ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, [pageSize, (page - 1) * pageSize])
        const total = Number(totals.total)
        return {
          records: rows.rows.map(row => ({ id: row.id, openid: row.openid, type: Number(row.type), amount: Number(row.amount),
            businessType: row.business_type, remark: row.remark || '', createdAt: row.created_at.getTime() })),
          page, pageSize, total, totalPage: Math.max(1, Math.ceil(total / pageSize)),
          rechargeTotal: Number(orders.amount), paidOrderCount: Number(orders.total),
          pointsConsumed: Number(totals.points), balanceConsumed: Number(totals.balance),
          byBusiness: business.rows.map(row => ({ name: row.business_type || '其他', amount: Number(row.amount),
            asset: Number(row.type) === 2 ? 'points' : 'balance', unit: Number(row.type) === 2 ? '积分' : '元' })),
          asOf: snapshot.rows[0].at.getTime()
        }
      }, { readOnly: true })
    }
  }
}

module.exports = { createFinanceService }
