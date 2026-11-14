'use strict'
const Ajv = require('ajv')
const contracts = require('../../contracts/architecture-v1.json')
const { identity } = require('../security.cjs')
const { createContactCipher } = require('../application/contact-cipher.cjs')
const { createRecruitmentService } = require('../modules/recruitment/service.cjs')
const { createWalletService } = require('../modules/wallet/service.cjs')
const { createLedger } = require('../modules/wallet/ledger.cjs')
const { createFinanceService } = require('../modules/finance/service.cjs')

// Keep strict command bodies local to migrated routes. In particular, the string
// "false" must never be coerced into an approval decision.
const validator = new Ajv({ coerceTypes: false, removeAdditional: false, strict: false })

function registerArchitectureRoutes(app, { pool, db, config }) {
  const recruitment = createRecruitmentService({ pool, encryptPhone: createContactCipher(config.contactKey), ledger: createLedger() })
  const wallet = createWalletService({ pool })
  const finance = createFinanceService({ pool })
  const routes = [
    ['POST', '/admin/jobs/:id/review', contracts.reviewJob, contracts.idParams,
      (actor, params, body) => recruitment.reviewJob(actor, params.id, body)],
    ['POST', '/insurances/purchase/:id', contracts.paidCommand, contracts.idParams,
      (actor, params, body) => wallet.purchaseInsurance(actor, params.id, body)],
    ['POST', '/jobs/top/:id', contracts.paidCommand, contracts.idParams,
      (actor, params, body) => recruitment.promoteJob(actor, params.id, 'top', body)],
    ['POST', '/jobs/refresh/:id', contracts.paidCommand, contracts.idParams,
      (actor, params, body) => recruitment.promoteJob(actor, params.id, 'refresh', body)],
    ['POST', '/jobs/apply/:id', contracts.applyJob, contracts.idParams,
      (actor, params, body) => recruitment.applyJob(actor, params.id, body)],
    ...[['accept', 'accepted'], ['reject', 'rejected']].map(([action, status]) =>
      ['POST', `/jobs/applicants/${action}/:jobId/:appId`, contracts.empty, contracts.applicationParams,
        (actor, params) => recruitment.changeApplication(actor, params.jobId, params.appId, status)]),
    ['POST', '/jobs/applications/cancel/:jobId/:appId', contracts.empty, contracts.applicationParams,
      (actor, params) => recruitment.changeApplication(actor, params.jobId, params.appId, 'cancelled')],
    ['GET', '/admin/finance', null, null,
      (actor, params, body, query) => finance.report(actor, query)]
  ]

  for (const [method, path, body, params, execute] of routes) {
    app.route({
      method, url: '/api' + path,
      schema: { ...(body ? { body } : {}), ...(params ? { params } : {}),
        querystring: method === 'GET' ? contracts.pagination : contracts.empty },
      validatorCompiler: ({ schema }) => validator.compile(schema),
      preValidation: async req => { if (method === 'POST' && req.body === undefined) req.body = {} },
      handler: async (req) => {
        const actor = { ...await identity(req, db, config), requestId: req.id }
        const data = await execute(actor, req.params, req.body || {}, req.query)
        return { success: true, code: 0, message: 'ok', data, requestId: req.id }
      }
    })
  }
  return new Set(routes.map(([method, path]) => `${method} ${path}`))
}

module.exports = { registerArchitectureRoutes }
