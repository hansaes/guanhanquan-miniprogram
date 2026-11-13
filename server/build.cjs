const Fastify = require('fastify')
const L = require('../cloudfunctions/api/lib')
const { createWechat } = require('./wechat.cjs')

async function build({ config, db, pool, wechat, logger = false, closePool = false }) {
  L.setDatabase(db, { adminSecret: config.adminSecret })
  process.env.ADMIN_SECRET = config.adminSecret
  process.env.CONTACT_KEY = config.contactKey
  process.env.PHONE_SALT = config.phoneSalt
  if (config.adminInitPassword) process.env.ADMIN_INIT_PASSWORD = config.adminInitPassword
  else delete process.env.ADMIN_INIT_PASSWORD
  process.env.PAY_SUB_MCH_ID = config.wechat.mchId || ''
  const app = Fastify({ logger, bodyLimit: 1024 * 1024, trustProxy: false })
  if (closePool) app.addHook('onClose', async () => pool.end())
  await app.register(require('./app.cjs'), { config, db, pool, wechat: wechat || createWechat(config.wechat) })
  await app.ready()
  return app
}
module.exports = { build }
