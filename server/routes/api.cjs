const L = require('../../cloudfunctions/api/lib')
const { ROUTES, handle } = require('../../cloudfunctions/api/router')
const { identity, userToken, equalSecret } = require('../security.cjs')
const files = require('../files.cjs')
const { settlePayment, createRecharge } = require('../payment.cjs')
const { registerArchitectureRoutes } = require('../interfaces/architecture.cjs')

module.exports = async function (app, { config, db, pool, wechat }) {
  const migratedRoutes = registerArchitectureRoutes(app, { config, db, pool })
  app.get('/health', async () => { await pool.query('SELECT 1'); return { status: 'ok', database: 'postgresql' } })

  app.post('/api/auth/dev-login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip)
    if (config.production || !local || !config.devLoginKey) return reply.code(404).send(L.fail('接口不存在', 404))
    if (!equalSecret(req.body && req.body.key, config.devLoginKey)) return reply.code(401).send(L.fail('开发登录密钥错误', 401))
    return login('dev-openid', req, reply)
  })

  async function login(openid, req, reply) {
    const result = await db.runInTransaction(() => handle({
      cloud: wechat.cloudFor(openid), openid, method: 'POST', path: '/auth/login', data: {}, token: '', isHttp: true, safeErrors: true
    }))
    if (result.success) result.data.token = userToken(openid, config)
    else reply.code(result.code >= 400 && result.code <= 599 ? result.code : 400)
    return files.hydrateFiles(result, config, { openid }, db)
  }

  app.post('/api/pay/wechat/notify', async (req, reply) => {
    const payment = await wechat.verifyAndDecryptPayment({ headers: req.headers, rawBody: req.rawBody })
    const result = await settlePayment(db, payment)
    if (!result.success) return reply.code(result.code).send({ code: 'FAIL', message: result.message })
    return reply.code(204).send()
  })
  app.post('/api/files', async (req, reply) => {
    const ctx = await identity(req, db, config)
    return files.upload(req, ctx, db, config)
  })
  app.get('/api/files/:id', (req, reply) => files.download(req, reply, db, config))

  for (const [method, routePath, handler, policy] of ROUTES) {
    if (migratedRoutes.has(`${method} ${routePath}`)) continue
    app.route({
      method, url: '/api' + routePath,
      config: routePath.endsWith('/login') ? { rateLimit: { max: 10, timeWindow: '1 minute' } } : {},
      handler: async (req, reply) => {
        if (routePath === '/auth/login') {
          const session = await wechat.exchangeCode(req.body && req.body.code)
          return login(session.openid, req, reply)
        }
        let phoneResult
        if (routePath === '/wallet/recharge' || routePath === '/auth/bind-phone') {
          const auth = await identity(req, db, config)
          if (!auth.openid) return reply.code(401).send(L.fail('请先登录', 401))
          if (routePath === '/wallet/recharge') {
            const result = await createRecharge(db, wechat, config, auth.openid, req.body && req.body.amount)
            if (!result.success) reply.code(result.code)
            return result
          }
          phoneResult = await wechat.cloudFor(auth.openid).openapi.phonenumber.getPhoneNumber({ code: req.body && req.body.code })
        }
        let authContext = {}
        const result = await db.runInTransaction(async () => {
          const auth = routePath === '/admin/login' ? { token: '', openid: '', admin: null } : await identity(req, db, config)
          authContext = auth
          if (policy === 'admin' && !auth.admin) return L.fail('请先登录管理后台', 401)
          if ((policy === 'user' || routePath === '/auth/register') && !auth.openid) return L.fail('请先登录', 401)
          const body = req.body || {}
          if (typeof body !== 'object' || Array.isArray(body)) return L.fail('请求内容必须为对象')
          const data = await files.normalizeFiles({ ...req.query, ...body }, auth, db, config)
          const cloud = wechat.cloudFor(auth.openid)
          if (phoneResult) cloud.openapi.phonenumber.getPhoneNumber = async () => phoneResult
          const upstreamFiles = cloud.getTempFileURL
          cloud.getTempFileURL = async ({ fileList }) => {
            const local = fileList.filter(id => files.fileId(id, config))
            const other = fileList.filter(id => !files.fileId(id, config))
            const external = upstreamFiles && other.length ? await upstreamFiles({ fileList: other }) : { fileList: [] }
            return { fileList: [...local.map(id => ({ fileID: id, tempFileURL: files.signedUrl(files.fileId(id, config), config) })), ...(external.fileList || [])] }
          }
          const output = await handle({
            cloud, openid: auth.openid, path: req.url.split('?')[0].slice(4),
            method, data, token: auth.token, isHttp: true, safeErrors: true
          })
          if (output.success && auth.admin && method !== 'GET') {
            await db.collection('auditLogs').add({ data: {
              adminId: auth.admin.adminId, username: auth.admin.username, method,
              path: routePath, targetId: req.params.id || (output.data && output.data.id) || '', createdAt: Date.now()
            } })
          }
          return output
        })
        if (!result.success) reply.code(result.code >= 400 && result.code <= 599 ? result.code : 400)
        return files.hydrateFiles(result, config, authContext, db)
      }
    })
  }
}
