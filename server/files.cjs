const fs = require('node:fs/promises')
const { createReadStream } = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const L = require('../cloudfunctions/api/lib')

const fileRef = /^ghq:\/\/([0-9a-f-]{36})$/
function fileId(value, config) {
  if (typeof value !== 'string') return null
  value = value.trim()
  const match = value.match(fileRef)
  if (match) return match[1]
  if (!value.startsWith(config.publicBaseUrl + '/files/')) return null
  try {
    const id = new URL(value).pathname.split('/').pop()
    return /^[0-9a-f-]{36}$/.test(id) ? id : null
  } catch { return null }
}
function signedUrl(id, config) {
  const token = L.signToken({ kind: 'file', id, exp: Date.now() + 15 * 60000 }, config.userSecret)
  return `${config.publicBaseUrl}/files/${id}?token=${encodeURIComponent(token)}`
}
async function transform(value, fn) {
  if (Array.isArray(value)) return Promise.all(value.map(v => transform(v, fn)))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = await transform(v, fn)
    return out
  }
  return fn(value)
}
async function normalizeFiles(value, ctx, db, config) {
  return transform(value, async v => {
    const id = fileId(v, config)
    if (!id) return v
    const file = await db.collection('uploads').doc(id).get().catch(() => null)
    if (!file?.data || (!ctx.admin && (!ctx.openid || file.data.openid !== ctx.openid))) throw Object.assign(new Error('无权引用该文件'), { statusCode: 403 })
    return 'ghq://' + id
  })
}
function hydrateFiles(value, config, context = {}, db) {
  // Response strings are not proof of access: handlers may trim, coerce, or
  // reformat user-controlled text into a file reference after input validation.
  const access = new Map()
  async function referenced(collection, filter) {
    const result = await db.collection(collection).where(filter).limit(1).get()
    return result.data.length > 0
  }
  async function canRead(id) {
    if (!db) return false
    const row = await db.collection('uploads').doc(id).get().catch(() => null)
    if (!row?.data) return false
    if (context.admin || (context.openid && row.data.openid === context.openid)) return true
    const reference = 'ghq://' + id
    // These fields are deliberately published by the corresponding handlers.
    if (await referenced('trainings', { enabled: true, cover: reference })) return true
    if (await referenced('banners', { enabled: true, imageUrl: reference })) return true
    if (await referenced('resumes', { status: 0, reviewStatus: 1, avatar: reference })) return true
    if (context.openid) {
      // The adapter supports regex matching of array items through its public
      // collection API. Boundaries ensure a different file cannot match a prefix.
      const certificateImages = db.RegExp({ regexp: '(^|,)' + reference + '(,|$)', options: '' })
      if (await referenced('resumes', { status: 0, reviewStatus: 1, certificateImages })) return true
    }
    return false
  }
  return transform(value, async v => {
    const id = fileId(v, config)
    if (!id) return v
    if (!access.has(id)) access.set(id, canRead(id))
    return await access.get(id) ? signedUrl(id, config) : ''
  })
}
function imageType(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ['png', 'image/png']
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return ['jpg', 'image/jpeg']
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return ['webp', 'image/webp']
  return null
}
async function upload(req, ctx, db, config) {
  if (!ctx.openid) throw Object.assign(new Error('请先登录'), { statusCode: 401 })
  const part = await req.file()
  if (!part) throw Object.assign(new Error('请选择图片'), { statusCode: 400 })
  const bytes = await part.toBuffer()
  const type = imageType(bytes)
  if (!type) throw Object.assign(new Error('只支持 PNG、JPEG、WebP 图片'), { statusCode: 400 })
  const id = crypto.randomUUID()
  const filename = `${id}.${type[0]}`
  const target = path.join(config.uploadDir, filename)
  await fs.mkdir(config.uploadDir, { recursive: true })
  await fs.writeFile(target, bytes, { flag: 'wx' })
  try {
    await db.collection('uploads').doc(id).set({ data: {
      openid: ctx.openid, filename, mimeType: type[1], size: bytes.length,
      dir: String(req.query.dir || 'upload').slice(0, 32), createdAt: Date.now()
    } })
  } catch (error) { await fs.unlink(target); throw error }
  return L.ok({ fileId: 'ghq://' + id, url: signedUrl(id, config) })
}
async function download(req, reply, db, config) {
  const token = L.verifyToken(req.query.token, config.userSecret)
  if (!token || token.kind !== 'file' || token.id !== req.params.id || !Number.isFinite(token.exp)) return reply.code(401).send(L.fail('文件链接已过期', 401))
  const row = await db.collection('uploads').doc(req.params.id).get().catch(() => null)
  if (!row || !/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(row.data.filename)) return reply.code(404).send(L.fail('文件不存在', 404))
  reply.header('Cache-Control', 'private, no-store').header('X-Content-Type-Options', 'nosniff').type(row.data.mimeType)
  return reply.send(createReadStream(path.join(config.uploadDir, row.data.filename)))
}
module.exports = { upload, download, normalizeFiles, hydrateFiles, signedUrl, fileId }
