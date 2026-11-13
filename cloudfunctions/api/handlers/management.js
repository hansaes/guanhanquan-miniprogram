const L = require('../lib')

// Business fields are explicit: this is not an arbitrary collection editor.
const PRODUCTS = {
  trainings: { fields: ['title', 'cover', 'price', 'type', 'teacher', 'intro', 'enabled'], required: ['title'], text: { title: 100, cover: 1000, type: 40, teacher: 80, intro: 2000 } },
  insurances: { fields: ['name', 'price', 'coverage', 'intro', 'enabled'], required: ['name', 'coverage'], text: { name: 100, coverage: 500, intro: 2000 } }
}
const SETTINGS = [
  ['contactCost', '查看电话', 5, 0, 100000, '积分'],
  ['topCost', '招工置顶', 30, 0, 100000, '积分'],
  ['refreshCost', '招工刷新', 5, 0, 100000, '积分'],
  ['signInPoints', '每日签到奖励', 2, 0, 10000, '积分'],
  ['profileTaskPoints', '完善资料奖励', 5, 0, 10000, '积分'],
  ['blacklistQueryCost', '信用查询', 0, 0, 100000, '积分'],
  ['topDays', '置顶有效期', 7, 1, 365, '天'],
  ['jobValidDays', '默认招工有效期', 7, 1, 365, '天']
]

function validObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}
function unknownFields(data, allowed) {
  return Object.keys(data).some((key) => !allowed.includes(key))
}
function validateProduct(data, schema) {
  if (!validObject(data) || unknownFields(data, schema.fields)) return '包含不支持的产品字段'
  for (const [key, limit] of Object.entries(schema.text)) {
    if (typeof data[key] !== 'string' || data[key].length > limit) return `${key} 需为不超过 ${limit} 字的文本`
    if (schema.required.includes(key) && !data[key].trim()) return '请填写产品名称和必要信息'
  }
  if (typeof data.enabled !== 'boolean') return '启用状态必须为布尔值'
  if (typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price < 0 || data.price > 1000000 || Math.abs(data.price * 100 - Math.round(data.price * 100)) > 0.000001) return '价格需为 0 至 1000000 元，最多两位小数'
  if (data.cover && !/^(https:\/\/[^\s]+|cloud:\/\/[^\s]+|ghq:\/\/[^\s]+|\/static\/[^\s]+)$/.test(data.cover)) return '封面需为 HTTPS、云存储或静态资源地址'
  return ''
}
function pagination(data) {
  for (const key of ['page', 'pageSize']) {
    if (data[key] !== undefined && (!/^\d+$/.test(String(data[key])) || !Number.isSafeInteger(Number(data[key])) || Number(data[key]) < 1)) throw new Error('分页参数必须为正整数')
  }
  const result = L.pager(data)
  if (!Number.isSafeInteger(result.skip)) throw new Error('页码超出范围')
  return result
}
async function list(collection, data, where, project = (row) => ({ ...row, id: row._id })) {
  let paging
  try { paging = pagination(data) } catch (error) { return L.fail(error.message) }
  const { page, pageSize, skip } = paging
  const query = L.db().collection(collection).where(where)
  const total = (await query.count()).total
  const rows = (await query.orderBy('createdAt', 'desc').orderBy('_id', 'desc').skip(skip).limit(pageSize).get()).data
  return L.ok(L.listResult(rows.map(project), total, page, pageSize))
}
function productHandlers(collection) {
  const schema = PRODUCTS[collection]
  return {
    async list(ctx) {
      const data = ctx.data || {}, where = {}
      if (data.enabled !== undefined && data.enabled !== '') {
        if (![true, false, 'true', 'false'].includes(data.enabled)) return L.fail('启用筛选值不合法')
        where.enabled = data.enabled === true || data.enabled === 'true'
      }
      if (data.keyword !== undefined && (typeof data.keyword !== 'string' || data.keyword.length > 100)) return L.fail('关键词过长')
      if (data.keyword) where[collection === 'trainings' ? 'title' : 'name'] = L.db().RegExp({ regexp: data.keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })
      return list(collection, data, where)
    },
    async save(ctx) {
      const error = validateProduct(ctx.data, schema)
      if (error) return L.fail(error)
      const record = {}
      for (const field of schema.fields) record[field] = typeof ctx.data[field] === 'string' ? ctx.data[field].trim() : ctx.data[field]
      record.updatedAt = Date.now()
      record.updatedBy = ctx.admin.adminId
      const id = ctx.params.id
      if (id) {
        const found = await L.db().collection(collection).where({ _id: id }).limit(1).get()
        if (!found.data.length) return L.fail('产品不存在', 404)
        await L.db().collection(collection).doc(id).update({ data: record })
        return L.ok({ id })
      }
      record.createdAt = record.updatedAt
      record.createdBy = ctx.admin.adminId
      const added = await L.db().collection(collection).add({ data: record })
      return L.ok({ id: added._id })
    },
    async deactivate(ctx) {
      const result = await L.db().collection(collection).where({ _id: ctx.params.id }).update({ data: { enabled: false, updatedAt: Date.now(), updatedBy: ctx.admin.adminId } })
      if (!result.stats || !result.stats.updated) return L.fail('产品不存在', 404)
      return L.ok({ id: ctx.params.id, enabled: false })
    }
  }
}
exports.trainings = productHandlers('trainings')
exports.insurances = productHandlers('insurances')

async function history(ctx, collection, productKey, productCollection) {
  const data = ctx.data || {}, where = {}
  if (data[productKey] !== undefined) {
    if (typeof data[productKey] !== 'string' || !data[productKey] || data[productKey].length > 128) return L.fail('产品标识不合法')
    where[productKey] = data[productKey]
  }
  const result = await list(collection, data, where, (row) => ({ id: row._id, productId: row[productKey], openid: row.openid, name: row.name, price: row.price, createdAt: row.createdAt }))
  if (!result.success || !result.data.records.length) return result
  const products = await L.db().collection(productCollection).where({ _id: L.cmd().in([...new Set(result.data.records.map((row) => row.productId))]) }).limit(50).get()
  const byId = new Map(products.data.map((row) => [row._id, row]))
  result.data.records = result.data.records.map((row) => ({ ...row, name: row.name || (byId.get(row.productId) || {}).title || (byId.get(row.productId) || {}).name || '产品已不可用' }))
  return result
}
exports.enrollments = (ctx) => history(ctx, 'training_enrolls', 'trainingId', 'trainings')
exports.purchases = (ctx) => history(ctx, 'user_insurances', 'insuranceId', 'insurances')

exports.settings = async () => {
  const rows = await L.db().collection('configs').where({ key: L.cmd().in(SETTINGS.map((entry) => entry[0])) }).limit(50).get()
  const values = new Map(rows.data.map((row) => [row.key, row.value]))
  return L.ok(SETTINGS.map(([key, label, fallback, min, max, unit]) => ({ key, label, value: values.has(key) ? values.get(key) : fallback, min, max, unit })))
}
exports.saveSettings = async (ctx) => {
  const data = ctx.data
  if (!validObject(data) || !Object.keys(data).length || unknownFields(data, SETTINGS.map((entry) => entry[0]))) return L.fail('包含不允许修改的配置项')
  for (const [key, , , min, max] of SETTINGS) {
    if (Object.hasOwn(data, key) && (!Number.isSafeInteger(data[key]) || data[key] < min || data[key] > max)) return L.fail(`${key} 必须为 ${min} 至 ${max} 的整数`)
  }
  const tx = await L.db().startTransaction()
  try {
    for (const [key, value] of Object.entries(data)) {
      const found = await tx.collection('configs').where({ key }).limit(1).get()
      const record = { key, value, updatedAt: Date.now(), updatedBy: ctx.admin.adminId }
      if (found.data.length) await tx.collection('configs').doc(found.data[0]._id).update({ data: record })
      else await tx.collection('configs').add({ data: record })
    }
    await tx.commit()
    return L.ok()
  } catch (error) { await tx.rollback(); throw error }
}

exports.appeals = async (ctx) => {
  const data = ctx.data || {}, where = { reportType: 6 }
  if (data.status !== undefined && data.status !== '') {
    if (!['0', '1', '2', '3'].includes(String(data.status))) return L.fail('申诉状态不合法')
    where.status = Number(data.status)
  }
  const result = await list('reports', data, where, (row) => ({ id: row._id, bossPhone: row.bossPhone, reason: row.reason, evidence: row.evidence || [], status: row.status, handleRemark: row.handleRemark || '', handleTime: row.handleTime, handlerId: row.handlerId, createdAt: row.createdAt }))
  if (!result.success) return result
  const fileIds = [...new Set(result.data.records.flatMap((row) => row.evidence).filter((id) => typeof id === 'string' && /^(cloud|ghq):\/\//.test(id)))]
  const urls = new Map()
  if (fileIds.length && ctx.cloud && ctx.cloud.getTempFileURL) {
    for (let i = 0; i < fileIds.length; i += 50) {
      const batch = await ctx.cloud.getTempFileURL({ fileList: fileIds.slice(i, i + 50) })
      for (const file of batch.fileList || []) if (file.tempFileURL) urls.set(file.fileID, file.tempFileURL)
    }
  }
  result.data.records = result.data.records.map((row) => ({ ...row, evidenceUrls: row.evidence.map((id) => urls.get(id) || (/^https:\/\//.test(id) ? id : '')).filter(Boolean) }))
  return result
}
exports.reviewAppeal = async (ctx) => {
  const data = ctx.data || {}
  if (unknownFields(data, ['status', 'remark']) || ![2, 3].includes(data.status)) return L.fail('请选择通过或驳回申诉')
  if (typeof data.remark !== 'string' || data.remark.trim().length < 2 || data.remark.length > 500) return L.fail('请填写 2 至 500 字的审核说明')
  const now = Date.now(), reviewerId = ctx.admin.adminId
  const salt = String(await L.getConfig('phoneSalt', process.env.PHONE_SALT || 'ghq-phone-salt'))
  const tx = await L.db().startTransaction()
  try {
    const reports = await tx.collection('reports').where({ _id: ctx.params.id, reportType: 6 }).limit(1).get()
    if (!reports.data.length) { await tx.rollback(); return L.fail('申诉不存在', 404) }
    const report = reports.data[0]
    if (![0, 1].includes(report.status)) { await tx.rollback(); return L.fail('该申诉已审核，请刷新列表', 409) }
    if (data.status === 2 && !/^1\d{10}$/.test(report.bossPhone)) { await tx.rollback(); return L.fail('申诉号码不完整，无法撤销标记') }
    const changed = await tx.collection('reports').where({ _id: ctx.params.id, reportType: 6, status: L.cmd().in([0, 1]) }).update({ data: { status: data.status, handleRemark: data.remark.trim(), handleTime: now, handlerId: reviewerId } })
    if (!changed.stats || changed.stats.updated !== 1) { await tx.rollback(); return L.fail('该申诉已审核，请刷新列表', 409) }
    let revoked = 0
    if (data.status === 2) {
      const result = await tx.collection('blacklist').where({ bossPhoneHash: L.hashPhone(report.bossPhone, salt), status: 1 }).update({ data: { status: 2, revokedBy: reviewerId, revokedAt: now, revokeReason: data.remark.trim() } })
      revoked = result.stats ? result.stats.updated : 0
    }
    if (report.reporterOpenid) await tx.collection('notifications').add({ data: { openid: report.reporterOpenid, title: data.status === 2 ? '申诉已通过' : '申诉未通过', content: data.remark.trim(), type: 2, isRead: false, createdAt: now } })
    await tx.commit()
    return L.ok({ id: ctx.params.id, status: data.status, revoked })
  } catch (error) { await tx.rollback(); throw error }
}
exports.auditLogs = (ctx) => list('auditLogs', ctx.data || {}, {}, (row) => ({ id: row._id, adminId: row.adminId, username: row.username, method: row.method, path: row.path, targetId: row.targetId, createdAt: row.createdAt }))
