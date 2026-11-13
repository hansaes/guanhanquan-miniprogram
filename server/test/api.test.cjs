const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { mkdtemp, rm } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { Pool } = require('pg')
const { migrate } = require('../db/migrate.cjs')
const { createDatabase } = require('../db/index.cjs')
const { build } = require('../build.cjs')
const { seedReferenceData } = require('../seed.cjs')
const { settlePayment, createRecharge } = require('../payment.cjs')
const L = require('../../cloudfunctions/api/lib')

test('HTTP + PostgreSQL complete business flows', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const namespace = 'api_test_' + randomUUID().replaceAll('-', '')
  const rootPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  await rootPool.query(`CREATE SCHEMA "${namespace}"`)
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${namespace}`, max: 8 })
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'ghq-api-test-'))
  let app
  t.after(async () => {
    if (app) await app.close()
    await pool.end()
    await rootPool.query(`DROP SCHEMA "${namespace}" CASCADE`)
    await rootPool.end()
    await rm(uploadDir, { recursive: true, force: true })
  })
  await migrate(pool)
  const db = createDatabase(pool)
  const config = {
    adminSecret: 'a'.repeat(40), userSecret: 'u'.repeat(40), contactKey: 'c'.repeat(40), phoneSalt: 'p'.repeat(40),
    adminInitPassword: 'integration-admin-password', publicBaseUrl: 'http://localhost:3001/api',
    origins: ['http://localhost:5174'], uploadDir, production: false, devLoginKey: 'development-key-12345', wechat: {}
  }
  const wechat = {
    exchangeCode: async code => {
      if (!['employer', 'worker', 'other'].includes(code)) throw Object.assign(new Error('invalid login code'), { statusCode: 400 })
      return { openid: code }
    },
    cloudFor: () => ({ openapi: { phonenumber: { getPhoneNumber: async () => ({ phoneInfo: { purePhoneNumber: '13800000000' } }) } } }),
    verifyAndDecryptPayment: () => { throw Object.assign(new Error('invalid signature'), { statusCode: 401 }) }
  }
  app = await build({ config, db, pool, wechat })
  await seedReferenceData(db)
  const request = async (method, route, data, token, expected = 200) => {
    const response = await app.inject({ method, url: '/api' + route, ...(data === undefined ? {} : { payload: data }), headers: token ? { authorization: 'Bearer ' + token } : {} })
    const body = response.json()
    assert.equal(response.statusCode, expected, route + ': ' + response.body)
    return body
  }
  let admin, employer, worker, other, jobId, appId, trainingId
  await t.test('authentication rejects spoofed openids and separates admin/user roles', async () => {
    const spoof = await app.inject({ method: 'GET', url: '/api/users/profile', headers: { 'x-openid': 'worker' } })
    assert.equal(spoof.statusCode, 401)
    await request('POST', '/auth/register', {}, undefined, 401)
    await request('POST', '/auth/login', { code: 'invalid' }, undefined, 400)
    employer = (await request('POST', '/auth/login', { code: 'employer' })).data.token
    worker = (await request('POST', '/auth/login', { code: 'worker' })).data.token
    other = (await request('POST', '/auth/login', { code: 'other' })).data.token
    admin = (await request('POST', '/admin/login', { username: 'admin', password: config.adminInitPassword })).data.token
    await request('POST', '/admin/login', { username: 'admin', password: config.adminInitPassword }, 'expired.invalid')
    await request('GET', '/admin/users', undefined, worker, 401)
    await request('GET', '/users/profile', undefined, admin, 401)
    const hash = (await db.collection('admins').get()).data[0].passwordHash
    assert.ok(hash.startsWith('scrypt:'))
    await request('POST', '/pay/wechat/notify', { resource: {} }, undefined, 401)
  })
  await t.test('WeChat identity persists across logins and profile updates stay scoped to the user', async () => {
    const before = (await request('GET', '/users/profile', undefined, worker)).data
    const loginAgain = await request('POST', '/auth/login', { code: 'worker', openid: 'employer' })
    assert.equal(loginAgain.data.user.id, before.id)
    assert.equal(loginAgain.data.session_key, undefined)
    for (const nickname of ['', '   ', {}, 'x'.repeat(21)]) {
      await request('PUT', '/users/profile', { nickname }, worker, 400)
    }
    await request('PUT', '/users/profile', { avatar: 'wxfile://temporary-avatar' }, worker, 400)
    await request('PUT', '/users/profile', { avatar: 'https://outside.invalid/photo.png' }, worker, 400)
    const updated = (await request('PUT', '/users/profile', {
      nickname: '  微信工友  ', avatar: '', points: 9999, _openid: 'employer', userType: 'employer'
    }, worker)).data
    assert.equal(updated.nickname, '微信工友')
    assert.equal(updated.id, before.id)
    assert.equal(updated.points, before.points)
    assert.equal(updated.userType, before.userType)
    assert.equal((await request('POST', '/auth/login', { code: 'worker' })).data.user.nickname, '微信工友')
    assert.equal((await request('GET', '/users/profile', undefined, employer)).data.nickname, '')
  })
  await t.test('job publication moderation search and ownership', async () => {
    const created = await request('POST', '/jobs/create', { title: '管工', categoryId: 'guandao', salary: 550, workArea: '沈阳', contactName: '张师傅', contactPhone: '13900001111' }, employer)
    jobId = created.data.id
    assert.equal((await request('GET', '/jobs/list', undefined, worker)).data.total, 0)
    await request('POST', `/admin/jobs/${jobId}/review`, { pass: true }, admin)
    assert.equal((await request('GET', '/jobs/list?keyword=管工&minSalary=500&maxSalary=600', undefined, worker)).data.total, 1)
    for (const route of ['/jobs/list', '/jobs/recommended/list', '/jobs/nearby/list', '/jobs/latest/list', '/categories/jobs/list/guandao']) {
      const guest = await request('GET', route, undefined, undefined, 401)
      assert.equal(guest.success, false)
      assert.equal(guest.data, null)
      await request('GET', route, undefined, 'expired.invalid', 401)
      await request('GET', route, undefined, worker)
    }
    await request('PUT', `/jobs/update/${jobId}`, { title: '越权改名' }, other, 403)
    const detail = (await request('GET', `/jobs/detail/${jobId}`)).data
    assert.ok(detail.contactPhone.includes('*'))
    assert.equal(detail.contactUnlocked, false)
  })
  await t.test('concurrent sign-in and contact unlock charge once', async () => {
    const responses = await Promise.all(Array.from({ length: 4 }, () => app.inject({ method: 'POST', url: '/api/wallet/sign-in', headers: { authorization: 'Bearer ' + worker } })))
    assert.equal(responses.filter(r => r.statusCode === 200).length, 1)
    assert.equal(responses.filter(r => r.statusCode === 409).length, 3)
    await db.collection('users').where({ _openid: 'worker' }).update({ data: { points: 50 } })
    await Promise.all(Array.from({ length: 3 }, () => request('POST', `/jobs/contact/${jobId}`, {}, worker)))
    assert.equal((await db.collection('users').where({ _openid: 'worker' }).get()).data[0].points, 45)
    assert.equal((await db.collection('unlocks').count()).total, 1)
  })
  await t.test('application acceptance notifications and favorites', async () => {
    await request('POST', '/auth/bind-phone', { code: 'phone' }, worker)
    const applied = await request('POST', `/jobs/apply/${jobId}`, { coverLetter: '十年施工经验' }, worker)
    appId = applied.data.id
    await request('GET', `/jobs/applicants/list/${jobId}`, undefined, other, 403)
    await request('POST', `/jobs/applicants/accept/${jobId}/${appId}`, {}, employer)
    assert.ok((await request('GET', '/notifications/list', undefined, worker)).data.records.length)
    await request('POST', '/favorites/toggle', { jobId }, worker)
    assert.equal((await request('GET', '/favorites/list', undefined, worker)).data.total, 1)
  })
  await t.test('content category and product CRUD persist with audit history', async () => {
    await request('POST', '/admin/categories', { id: 'hanjie', key: 'hanjie', name: '焊接工', enabled: false, sort: 2, icon: '', description: '测试' }, admin)
    assert.ok(!(await request('GET', '/categories/list')).data.some(c => c.id === 'hanjie'))
    await request('PUT', '/admin/settings', { contactCost: 8 }, admin)
    await request('PUT', '/admin/settings', { adminSecret: 'leak' }, admin, 400)
    assert.equal((await request('GET', '/wallet/info', undefined, worker)).data.contactCost, 8)
    const training = await request('POST', '/admin/trainings', { title: '焊接课', cover: '', type: '线上', teacher: '老师', intro: '简介', price: 0, enabled: true }, admin)
    trainingId = training.data.id
    await request('POST', `/trainings/enroll/${trainingId}`, {}, worker)
    await request('POST', `/trainings/enroll/${trainingId}`, {}, worker)
    assert.equal((await db.collection('training_enrolls').count()).total, 1)
    await request('DELETE', `/admin/trainings/${trainingId}`, undefined, admin)
    await request('POST', `/trainings/enroll/${trainingId}`, {}, other, 409)
    assert.equal((await request('GET', '/trainings/my', undefined, worker)).data.records.length, 1)
    assert.ok((await request('GET', '/admin/audit-logs', undefined, admin)).data.total >= 4)
  })
  await t.test('resume and identity review control public visibility', async () => {
    const resume = await request('PUT', '/workers/profile/update', { name: '李师傅', jobTypes: ['管工'], contactPhone: '13800000000', status: 0, certificateImages: [] }, worker)
    assert.equal((await request('GET', '/workers/list')).data.total, 0)
    await request('POST', `/admin/resumes/${resume.data.id}/review`, { pass: true }, admin)
    assert.equal((await request('GET', '/workers/list')).data.total, 1)
    await request('POST', '/users/real-name', { realName: '李师傅', idCard: '110101199001011234' }, worker)
    const profile = (await request('GET', '/users/profile', undefined, worker)).data
    assert.equal(profile.realNameVerified, false)
    await request('POST', `/admin/verifications/${profile.id}/review`, { type: 'real', pass: true }, admin)
    assert.equal((await request('GET', '/users/profile', undefined, worker)).data.realNameVerified, true)
  })
  await t.test('blacklist appeal review updates records and preserves history', async () => {
    const report = await request('POST', '/blacklist/submit', { bossPhone: '13900001111', bossName: '张', reasonType: 1, reasonDetail: '验收使用的欠薪举报记录，请勿用于真实业务', evidence: [] }, worker)
    await request('POST', `/admin/blacklist/${report.data.id}/review`, { pass: true }, admin)
    assert.equal((await request('GET', '/blacklist/query?phone=13900001111', undefined, employer)).data.count, 1)
    const appeal = await request('POST', '/blacklist/appeal', { phone: '13900001111', reason: '验收测试申诉材料，已证明全部结清' }, employer)
    await request('POST', `/admin/appeals/${appeal.data.id}/review`, { status: 2, remark: '核验材料通过' }, admin)
    await request('POST', `/admin/appeals/${appeal.data.id}/review`, { status: 3, remark: '重复处理测试' }, admin, 409)
    assert.equal((await request('GET', '/blacklist/query?phone=13900001111', undefined, employer)).data.count, 0)
    assert.equal((await db.collection('reports').doc(appeal.data.id).get()).data.status, 2)
  })
  await t.test('payment settlement is atomic idempotent and checks payer/amount', async () => {
    await db.collection('orders').add({ data: { outTradeNo: 'PG-INTEGRATION-1', openid: 'worker', amount: 12.34, fen: 1234, status: 'pending', type: 'recharge', createdAt: Date.now() } })
    const event = { outTradeNo: 'PG-INTEGRATION-1', openid: 'worker', totalFee: 1234, transactionId: 'WX-TRANSACTION-1' }
    assert.equal((await settlePayment(db, { ...event, openid: 'other' })).success, false)
    const rows = await Promise.all(Array.from({ length: 3 }, () => settlePayment(db, event)))
    assert.ok(rows.every(r => r.success))
    assert.equal((await db.collection('users').where({ _openid: 'worker' }).get()).data[0].balance, 12.34)
    assert.equal((await db.collection('wallet').where({ businessId: event.outTradeNo }).count()).total, 1)
  })
  await t.test('prepay network I/O does not hold a database transaction lock', async () => {
    const gateway = { cloudFor: () => ({ cloudPay: { unifiedOrder: async order => {
      const result = await settlePayment(db, { outTradeNo: order.outTradeNo, openid: 'worker', totalFee: order.totalFee, transactionId: 'WX-NETWORK-RACE' })
      assert.equal(result.success, true)
      return { returnCode: 'SUCCESS', resultCode: 'SUCCESS', payment: { package: 'prepay_id=test' } }
    } } }) }
    const result = await createRecharge(db, gateway, { wechat: { mchId: 'test-mch' } }, 'worker', 1.01)
    assert.equal(result.success, true)
    assert.equal((await db.collection('orders').where({ outTradeNo: result.data.outTradeNo }).get()).data[0].status, 'paid')
    assert.equal((await createRecharge(db, gateway, config, 'worker', 1.001)).success, false)
  })
  await t.test('insurance purchase debits exact balance and retains historical price', async () => {
    const insurance = await request('POST', '/admin/insurances', { name: '验收保障', coverage: '施工保障', intro: '验收用', price: 2.34, enabled: true }, admin)
    await request('POST', `/insurances/purchase/${insurance.data.id}`, {}, worker)
    assert.equal((await db.collection('users').where({ _openid: 'worker' }).get()).data[0].balance, 11.01)
    await request('DELETE', `/admin/insurances/${insurance.data.id}`, undefined, admin)
    await request('POST', `/insurances/purchase/${insurance.data.id}`, {}, worker, 409)
    assert.equal((await request('GET', '/users/insurances/list', undefined, worker)).data[0].price, 2.34)
  })
  await t.test('private upload refuses unauthenticated and unrelated user access', async () => {
    const boundary = 'ghq-boundary'
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`), Buffer.from([137,80,78,71,13,10,26,10,0,0]), Buffer.from(`\r\n--${boundary}--\r\n`)])
    const response = await app.inject({ method: 'POST', url: '/api/files?dir=feedback', payload: body, headers: { authorization: 'Bearer ' + worker, 'content-type': 'multipart/form-data; boundary=' + boundary } })
    assert.equal(response.statusCode, 200, response.body)
    const uploaded = response.json().data
    const link = new URL(uploaded.url)
    assert.equal((await app.inject(link.pathname + link.search)).statusCode, 200)
    assert.equal((await app.inject(link.pathname)).statusCode, 401)
    await request('POST', '/feedback/create', { content: '附件测试内容', images: [uploaded.url] }, other, 403)
    await request('POST', '/feedback/create', { content: '附件测试内容', images: [uploaded.url] }, worker)
    assert.equal((await db.collection('feedback').get()).data[0].images[0], uploaded.fileId)
    await request('PUT', '/users/profile', { avatar: uploaded.url }, worker)
    assert.ok((await request('GET', '/users/profile', undefined, worker)).data.avatar.includes('/api/files/'))
    const loginAgain = (await request('POST', '/auth/login', { code: 'worker' })).data
    assert.ok(loginAgain.user.avatar.includes('/api/files/'))
    await request('PUT', '/users/profile', { avatar: uploaded.url }, other, 403)
  })
  await t.test('management lists and existing frontend data endpoints all query PostgreSQL', async () => {
    for (const route of ['/content/ui','/categories/list','/banners/list','/announcements/list','/workers/list','/trainings/list','/insurances/list']) await request('GET', route)
    for (const route of ['/admin/overview','/admin/content','/admin/categories','/admin/jobs','/admin/users','/admin/verifications','/admin/resumes','/admin/blacklist','/admin/reports','/admin/announcements','/admin/banners','/admin/finance','/admin/feedback','/admin/trainings','/admin/insurances','/admin/settings','/admin/appeals','/admin/training-enrollments','/admin/insurance-purchases','/admin/audit-logs']) await request('GET', route, undefined, admin)
    for (const route of ['/users/profile','/employers/profile','/workers/profile','/jobs/my-applications','/employers/jobs/list','/wallet/info','/wallet/records','/feedback/list','/users/insurances/list']) await request('GET', route, undefined, worker)
    const secondPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${namespace}` })
    try { assert.equal((await createDatabase(secondPool).collection('jobs').doc(jobId).get()).data.title, '管工') } finally { await secondPool.end() }
  })
  await t.test('disabled users cannot keep using issued tokens', async () => {
    const user = (await db.collection('users').where({ _openid: 'other' }).get()).data[0]
    await request('POST', `/admin/users/${user._id}/status`, { status: 1 }, admin)
    await request('GET', '/users/profile', undefined, other, 401)
  })
})
