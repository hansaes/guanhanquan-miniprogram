const crypto = require('node:crypto')
const L = require('../cloudfunctions/api/lib')

function equalSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}
function userToken(openid, config) {
  return L.signToken({ kind: 'user', openid, exp: Date.now() + 7 * 24 * 3600000 }, config.userSecret)
}
function bearer(req) { return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') }
async function identity(req, db, config) {
  const token = bearer(req)
  if (!token) return { token: '', openid: '', admin: null }
  const user = L.verifyToken(token, config.userSecret)
  if (user && user.kind === 'user' && typeof user.openid === 'string' && Number.isFinite(user.exp)) {
    const found = await db.collection('users').where({ _openid: user.openid }).limit(1).get()
    if (found.data[0] && found.data[0].status !== 1) return { token, openid: user.openid, admin: null }
  }
  const admin = L.verifyToken(token, config.adminSecret)
  if (admin && typeof admin.adminId === 'string' && Number.isFinite(admin.exp)) {
    const found = await db.collection('admins').doc(admin.adminId).get().catch(() => null)
    if (found && found.data && found.data.enabled !== false && found.data.role === 'super' && found.data.username === admin.username) return { token, openid: '', admin }
  }
  throw Object.assign(new Error('登录已过期，请重新登录'), { statusCode: 401 })
}
module.exports = { equalSecret, userToken, bearer, identity }
