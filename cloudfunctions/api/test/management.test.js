const assert = require('node:assert/strict')
process.env.ADMIN_INIT_PASSWORD = 'management-test-password'
process.env.ADMIN_SECRET = 'management-test-secret'
const mock = require('./mock-cloud')
const { handle } = require('../router')
const L = require('../lib')
const call = (method, path, data = {}, token = '', openid = '') => handle({ method, path, data, token, openid, cloud: mock.fakeSdk })

async function main() {
  mock.reset()
  const login = await call('POST', '/admin/login', { username: 'admin', password: process.env.ADMIN_INIT_PASSWORD })
  assert.equal(login.success, true)
  const token = login.data.token
  const admin = (method, path, data = {}) => call(method, path, data, token)
  for (const path of ['/admin/trainings', '/admin/insurances', '/admin/settings', '/admin/appeals', '/admin/audit-logs', '/admin/training-enrollments', '/admin/insurance-purchases']) assert.equal((await call('GET', path)).code, 401, path)

  const course = { title: '焊接安全培训', price: 0, cover: '', type: 'safety', teacher: '张老师', intro: '现场安全培训', enabled: true }
  const created = await admin('POST', '/admin/trainings', course)
  assert.equal(created.success, true)
  const trainingId = created.data.id
  assert.equal((await call('GET', '/trainings/list')).data[0].title, course.title)
  for (const price of [-1, NaN, Infinity, '30', 0.001, 1000001]) assert.equal((await admin('POST', '/admin/trainings', { ...course, price })).code, 400)
  for (const cover of ['javascript:alert(1)', 'http://example.test/cover.png', 'data:image/svg+xml,<svg>']) assert.equal((await admin('POST', '/admin/trainings', { ...course, cover })).code, 400)
  assert.equal((await admin('POST', '/admin/trainings', { ...course, _id: 'override' })).code, 400)
  assert.equal((await admin('POST', '/admin/trainings', { ...course, enabled: 'true' })).code, 400)
  assert.equal((await admin('PUT', '/admin/trainings/missing', course)).code, 404)
  assert.equal((await admin('PUT', `/admin/trainings/${trainingId}`, { ...course, title: '焊接安全新版' })).success, true)
  assert.equal((await admin('GET', '/admin/trainings', { keyword: '安全新' })).data.total, 1)
  assert.equal((await admin('GET', '/admin/trainings', { keyword: '[.*' })).data.total, 0, 'keyword must be treated literally')
  assert.equal((await admin('GET', '/admin/trainings', { page: 'oops' })).code, 400)
  assert.equal((await admin('GET', '/admin/trainings', { enabled: 'oops' })).code, 400)
  assert.equal((await admin('GET', '/admin/trainings', { pageSize: 10000 })).data.pageSize, 50)

  const enrolled = await call('POST', `/trainings/enroll/${trainingId}`, {}, '', 'student')
  assert.equal(enrolled.success, true)
  const repeated = await call('POST', `/trainings/enroll/${trainingId}`, {}, '', 'student')
  assert.equal(repeated.data.id, enrolled.data.id)
  assert.equal(mock.dump('training_enrolls').length, 1)
  assert.equal((await admin('DELETE', `/admin/trainings/${trainingId}`)).success, true)
  assert.equal((await call('GET', '/trainings/list')).data.length, 0)
  assert.equal((await call('POST', `/trainings/enroll/${trainingId}`, {}, '', 'another-student')).code, 409)
  assert.equal((await call('GET', '/trainings/my', {}, '', 'student')).data.records[0].trainingId, trainingId)
  assert.equal((await admin('GET', '/admin/training-enrollments', { trainingId })).data.total, 1)
  assert.equal((await admin('GET', '/admin/trainings', { enabled: 'false' })).data.total, 1)
  assert.equal(mock.dump('trainings').length, 1, 'deactivation must preserve course history')

  const insurance = { name: '施工意外险', price: 30.5, coverage: '意外医疗', intro: '30 天', enabled: true }
  const insuranceId = (await admin('POST', '/admin/insurances', insurance)).data.id
  await L.db().collection('users').where({ _openid: 'student' }).update({ data: { balance: 100 } })
  assert.equal((await call('POST', `/insurances/purchase/${insuranceId}`, { price: 0 }, '', 'student')).success, true)
  assert.equal(mock.dump('user_insurances')[0].price, 30.5, 'purchase uses persisted price')
  assert.equal(mock.dump('users').find((row) => row._openid === 'student').balance, 69.5)
  assert.equal((await admin('PUT', `/admin/insurances/${insuranceId}`, { ...insurance, price: 40 })).success, true)
  assert.equal((await admin('DELETE', `/admin/insurances/${insuranceId}`)).success, true)
  assert.equal((await call('POST', `/insurances/purchase/${insuranceId}`, {}, '', 'student')).code, 409)
  assert.equal((await call('GET', '/users/insurances/list', {}, '', 'student')).data[0].price, 30.5)
  assert.equal((await admin('GET', '/admin/insurance-purchases', { insuranceId })).data.records[0].price, 30.5)
  assert.equal((await admin('DELETE', '/admin/insurances/missing')).code, 404)

  await L.setConfig('adminSecret', process.env.ADMIN_SECRET)
  await L.setConfig('phoneSalt', 'test-phone-salt')
  const settings = (await admin('GET', '/admin/settings')).data
  assert.equal(settings.length, 8)
  assert.equal(settings.some((row) => /secret|salt/i.test(row.key)), false)
  for (const data of [{ adminSecret: 'hijack' }, { signInPoints: -1 }, { topDays: 0 }, { topCost: 1.5 }, { contactCost: Infinity }, { jobValidDays: 366 }]) assert.equal((await admin('PUT', '/admin/settings', data)).code, 400)
  assert.equal((await admin('PUT', '/admin/settings', { contactCost: 12, signInPoints: 3 })).success, true)
  assert.equal((await call('GET', '/wallet/info', {}, '', 'student')).data.contactCost, 12)
  assert.equal((await admin('PUT', '/admin/settings', { contactCost: 99, signInPoints: -1 })).code, 400)
  assert.equal(await L.getConfig('contactCost'), 12, 'invalid setting batch must not partially apply')

  const phone = '13800000001', hash = L.hashPhone(phone, 'test-phone-salt')
  const report = await L.db().collection('reports').add({ data: { reportType: 6, reporterOpenid: 'student', bossPhone: phone, reason: '证据已经澄清，请审核并撤销', evidence: ['https://example.test/evidence.png', 'ghq://uploads/evidence.png'], status: 0, createdAt: Date.now() } })
  for (let i = 0; i < 53; i++) await L.db().collection('blacklist').add({ data: { bossPhoneHash: hash, status: 1 } })
  await L.db().collection('blacklist').add({ data: { bossPhoneHash: 'unrelated', status: 1 } })
  const regularReport = await L.db().collection('reports').add({ data: { reportType: 1, status: 0 } })
  assert.equal((await admin('GET', '/admin/appeals', { status: 0 })).data.total, 1)
  assert.deepEqual((await admin('GET', '/admin/appeals')).data.records[0].evidenceUrls, ['https://example.test/evidence.png', 'ghq://uploads/evidence.png'])
  assert.equal((await admin('POST', `/admin/appeals/${regularReport._id}/review`, { status: 2, remark: '核实通过' })).code, 404)
  assert.equal((await admin('POST', `/admin/appeals/${report._id}/review`, { status: 2, remark: '' })).code, 400)
  assert.equal((await admin('POST', `/admin/appeals/${report._id}/review`, { status: 1, remark: '核实通过' })).code, 400)
  const reviewed = await admin('POST', `/admin/appeals/${report._id}/review`, { status: 2, remark: '证据核实，撤销标记' })
  assert.equal(reviewed.success, true)
  assert.equal(reviewed.data.revoked, 53, 'approval must revoke all confirmed markers, beyond a default page')
  assert.equal(mock.dump('blacklist').filter((row) => row.status === 1).length, 1)
  assert.equal(mock.dump('notifications').filter((row) => row.openid === 'student').length, 1)
  assert.equal((await admin('POST', `/admin/appeals/${report._id}/review`, { status: 3, remark: '重复操作' })).code, 409)
  assert.equal((await admin('POST', `/admin/reports/${report._id}/handle`, { status: 0, remark: '重新处理' })).code, 409)
  assert.equal((await admin('POST', `/admin/reports/${report._id}/handle`, { status: 3, remark: '旧入口重复操作' })).code, 409)
  assert.equal(mock.dump('notifications').filter((row) => row.openid === 'student').length, 1)

  const rejectedReport = await L.db().collection('reports').add({ data: { reportType: 6, reporterOpenid: 'student', bossPhone: '13800000002', status: 0 } })
  assert.equal((await admin('POST', `/admin/reports/${rejectedReport._id}/handle`, { status: 3, remark: '证据不足' })).success, true)
  assert.equal(mock.dump('notifications').filter((row) => row.openid === 'student').length, 2)
  await L.db().collection('auditLogs').add({ data: { adminId: 'admin', username: 'admin', method: 'PUT', path: '/admin/settings', targetId: '', createdAt: Date.now(), requestBody: { secret: 'must-not-leak' } } })
  const audit = (await admin('GET', '/admin/audit-logs')).data
  assert.equal(audit.total, 1)
  assert.equal(audit.records[0].requestBody, undefined)
  // A notification failure must roll back both the appeal and its marker revocations.
  const rollbackReport = await L.db().collection('reports').add({ data: { reportType: 6, reporterOpenid: 'student', bossPhone: phone, status: 0 } })
  const rollbackMarker = await L.db().collection('blacklist').add({ data: { bossPhoneHash: hash, status: 1 } })
  const database = L.db(), originalStart = database.startTransaction
  const originalLog = console.error
  database.startTransaction = async () => {
    const tx = await originalStart()
    const originalCollection = tx.collection
    tx.collection = (name) => {
      const collection = originalCollection(name)
      if (name === 'notifications') collection.add = async () => { throw new Error('injected notification failure') }
      return collection
    }
    return tx
  }
  try {
    console.error = () => {}
    assert.equal((await admin('POST', `/admin/appeals/${rollbackReport._id}/review`, { status: 2, remark: '核实通过' })).code, 500)
  } finally { database.startTransaction = originalStart; console.error = originalLog }
  assert.equal(mock.dump('reports').find((row) => row._id === rollbackReport._id).status, 0)
  assert.equal(mock.dump('blacklist').find((row) => row._id === rollbackMarker._id).status, 1)
  console.log('Management CRUD, safe pricing/config, retained history, appeal moderation and audit projection: passed')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
