'use strict'
const { randomUUID } = require('node:crypto')
const { transaction } = require('../../application/transaction.cjs')
const { requireUser } = require('../../application/actors.cjs')
const { requireCondition } = require('../../application/errors.cjs')
const { once } = require('../../application/idempotency.cjs')
const { debit, moneyToCents } = require('./repository.cjs')

/** @param {{ pool: import('pg').Pool }} dependencies */
function createWalletService({ pool }) {
  return {
    /** @param {import('../../application/types').Actor} actor @param {string} id @param {import('../../../contracts/architecture-v1').PaidCommandInput} input */
    async purchaseInsurance(actor, id, input) {
      return transaction(pool, async client => {
        const user = await requireUser(client, actor)
        return once(client, { actor: user.openid, operation: 'insurance.purchase', key: input.idempotencyKey, resource: id }, async () => {
          const product = (await client.query('SELECT name, price, enabled FROM insurances WHERE id = $1 FOR SHARE', [id])).rows[0]
          requireCondition(product, 404, 'PRODUCT_NOT_FOUND', '保险产品不存在')
          requireCondition(product.enabled === true, 409, 'PRODUCT_DISABLED', '保险产品已下架')
          const cents = moneyToCents(String(product.price))
          const purchaseId = randomUUID()
          const charged = await debit(client, {
            openid: user.openid, asset: 'balance', units: cents,
            businessType: '购买保险', businessId: purchaseId, remark: product.name
          })
          requireCondition(charged, 402, 'INSUFFICIENT_BALANCE', '余额不足')
          await client.query(
            'INSERT INTO user_insurances (id, openid, insurance_id, name, price) VALUES ($1, $2, $3, $4, $5::numeric / 100)',
            [purchaseId, user.openid, id, product.name, cents]
          )
          return { id: purchaseId }
        })
      })
    }
  }
}

module.exports = { createWalletService }
