'use strict'
const { debit, integerSetting } = require('./repository.cjs')

// Public wallet port: recruitment may charge points within its transaction,
// but cannot directly update an account or write a ledger row.
function createLedger() {
  return {
    /** @param {import('pg').PoolClient} client @param {'top'|'refresh'} action */
    async promotionTerms(client, action) {
      return {
        cost: await integerSetting(client, action === 'top' ? 'topCost' : 'refreshCost', action === 'top' ? 30 : 5, 0, 100000),
        days: action === 'top' ? await integerSetting(client, 'topDays', 7, 1, 365) : 0
      }
    },
    /** @param {import('pg').PoolClient} client @param {{openid: string, units: number, businessType: string, businessId: string, remark: string}} charge */
    debitPoints(client, charge) {
      return debit(client, { ...charge, asset: 'points' })
    }
  }
}
module.exports = { createLedger }
