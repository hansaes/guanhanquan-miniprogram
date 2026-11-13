'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { createDatabase } = require('../db/index.cjs')
const { migrate } = require('../db/migrate.cjs')
const { schema } = require('../db/schema.cjs')

test('PostgreSQL persistence and transaction guarantees', { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const { Pool } = require('pg')
  const namespace = 'ghq_test_' + randomUUID().replaceAll('-', '')
  const bootstrap = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  await bootstrap.query(`CREATE SCHEMA "${namespace}"`)
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${namespace}`, max: 12 })
  const db = createDatabase(pool)
  t.after(async () => {
    await pool.end()
    await bootstrap.query(`DROP SCHEMA "${namespace}" CASCADE`)
    await bootstrap.end()
  })
  await migrate(pool)
  await migrate(pool)
  const now = Date.now()
  await db.runInTransaction(async () => {
    await db.collection('users').add({ data: { _id: 'worker', _openid: 'worker-openid', nickname: '李师傅', points: 100, balance: 50, createdAt: now } })
    await db.collection('users').add({ data: { _id: 'employer', _openid: 'employer-openid', nickname: '张工', userType: 'employer', createdAt: now } })
    await db.collection('categories').doc('hanjie').set({ data: { key: 'hanjie', name: '焊工', sort: 1 } })
    await db.collection('admins').add({ data: { _id: 'admin', username: 'test-admin', salt: 's', passwordHash: 'hash' } })
    await db.collection('jobs').add({ data: { _id: 'job-a', ownerOpenid: 'employer-openid', categoryId: 'hanjie', title: '焊工 Alpha', salary: 600, status: 1, expireAt: now + 86400000, createdAt: now } })
    await db.collection('jobs').add({ data: { _id: 'job-b', ownerOpenid: 'employer-openid', categoryId: 'hanjie', title: '管工 beta', salary: 500, status: 1, expireAt: now + 86400000, createdAt: now } })
  })

  await t.test('every collection mapping is backed by actual typed columns', async () => {
    const columns = await pool.query('SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = $1', [namespace])
    const set = new Set(columns.rows.map((row) => row.table_name + '.' + row.column_name))
    for (const definition of Object.values(schema)) {
      for (const spec of Object.values(definition.fields)) {
        assert.ok(set.has(definition.table + '.' + spec.column), definition.table + '.' + spec.column)
      }
    }
    assert.equal(columns.rows.find((row) => row.table_name === 'jobs' && row.column_name === 'created_at').data_type, 'timestamp with time zone')
    assert.equal(columns.rows.find((row) => row.table_name === 'wallet' && row.column_name === 'amount').data_type, 'numeric')
    assert.equal((await pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count, '1')
  })

  await t.test('typed values, arrays, optional attrs and enterprise profile retain the cloud API shape', async () => {
    await db.collection('users').doc('worker').update({ data: { enterprise: { companyName: '测试企业', address: '沈阳' }, customLabel: 'extension' } })
    const user = (await db.collection('users').doc('worker').get()).data
    assert.equal(user._openid, 'worker-openid')
    assert.equal(user.createdAt, now)
    assert.equal(user.balance, 50)
    assert.equal(user.customLabel, 'extension')
    assert.deepEqual(user.enterprise, { companyName: '测试企业', address: '沈阳' })
    assert.equal(user.enterprise_company_name, undefined)
    await db.collection('resumes').add({ data: { _id: 'resume', _openid: 'worker-openid', jobTypes: ['管工', '焊工'], certificateImages: ['ghq://one'], reviewStatus: 1 } })
    assert.equal((await db.collection('resumes').where({ jobTypes: db.RegExp({ regexp: '焊工', options: 'i' }) }).count()).total, 1)
    assert.deepEqual((await db.collection('resumes').doc('resume').get()).data.jobTypes, ['管工', '焊工'])
    await db.collection('configs').add({ data: { key: 'uiContent', value: { nested: ['测试', 42] } } })
    assert.deepEqual((await db.collection('configs').where({ key: 'uiContent' }).get()).data[0].value, { nested: ['测试', 42] })
  })

  await t.test('composed comparisons, regex, pagination and immutable queries match business filters', async () => {
    const base = db.collection('jobs').where({ status: 1 })
    assert.equal((await base.where({ salary: db.command.gte(550).and(db.command.lte(650)) }).count()).total, 1)
    const filter = db.command.and([{ status: 1 }, db.command.or([
      { title: db.RegExp({ regexp: 'ALPHA', options: 'i' }) }, { salary: db.command.lt(550) }
    ])])
    assert.equal((await db.collection('jobs').where(filter).count()).total, 2)
    assert.equal((await base.orderBy('salary', 'desc').skip(1).limit(1).get()).data[0]._id, 'job-b')
    assert.equal((await base.get()).data.length, 2)
    assert.equal((await base.where({ _id: db.command.in(['job-a']) }).count()).total, 1)
    assert.equal((await base.where({ salaryUnit: db.command.nin([2, 3, 4]) }).count()).total, 2)
    assert.equal((await base.where({ _id: db.command.in([]) }).count()).total, 0)
    assert.equal((await base.where({ createdAt: db.command.gt(now - 1) }).count()).total, 2)
    assert.equal((await db.collection('users').where({ nickname: "' OR 1=1 --" }).count()).total, 0)
    assert.equal((await db.collection('users').where({ 'customLabel': 'extension' }).count()).total, 1)
    assert.throws(() => db.collection('users; DROP TABLE users'), /Unknown collection/)
  })

  await t.test('set replaces values and remove reports the affected row count', async () => {
    await db.collection('categories').doc('replace').set({ data: { key: 'replace', name: '原名称', description: 'old', custom: 'old' } })
    await db.collection('categories').doc('replace').set({ data: { key: 'replace', name: '新名称' } })
    const row = (await db.collection('categories').doc('replace').get()).data
    assert.equal(row.description, '')
    assert.equal(row.custom, undefined)
    assert.equal((await db.collection('categories').doc('replace').remove()).stats.removed, 1)
    assert.equal((await db.collection('categories').doc('replace').remove()).stats.removed, 0)
    await assert.rejects(db.collection('categories').doc('replace').get(), { code: 'DOCUMENT_NOT_FOUND' })
  })

  await t.test('failed business results and thrown errors roll back all writes', async () => {
    const before = (await db.collection('users').doc('worker').get()).data.points
    const result = await db.runInTransaction(async () => {
      await db.collection('users').doc('worker').update({ data: { points: db.command.inc(-10) } })
      await db.collection('wallet').add({ data: { openid: 'worker-openid', type: 2, amount: -10, businessType: 'failed-flow' } })
      return { success: false, code: 402 }
    })
    assert.equal(result.success, false)
    assert.equal((await db.collection('users').doc('worker').get()).data.points, before)
    assert.equal((await db.collection('wallet').where({ businessType: 'failed-flow' }).count()).total, 0)
    await assert.rejects(db.runInTransaction(async () => {
      await db.collection('users').doc('worker').update({ data: { points: db.command.inc(-20) } })
      throw new Error('simulated failure')
    }), /simulated failure/)
    assert.equal((await db.collection('users').doc('worker').get()).data.points, before)
    await assert.rejects(db.runInTransaction(async () => {
      await db.collection('users').doc('worker').update({ data: { nickname: 'must roll back' } })
      await db.collection('users').doc('worker').update({ data: { points: -1 } }).catch(() => {})
      return { success: true }
    }), /aborted before commit/)
    assert.equal((await db.collection('users').doc('worker').get()).data.nickname, '李师傅')
  })

  await t.test('nested savepoints isolate rollback and preserve the parent transaction', async () => {
    await db.runInTransaction(async () => {
      await db.collection('configs').doc('parent').set({ data: { key: 'parent', value: 1 } })
      const tx = await db.startTransaction()
      await tx.collection('configs').doc('child').set({ data: { key: 'child', value: 2 } })
      await tx.rollback()
      await assert.rejects(tx.collection('configs').get(), /already closed/)
      await db.runInTransaction(async () => {
        await db.collection('configs').doc('child-failed').set({ data: { key: 'child-failed', value: 3 } })
        return { success: false }
      })
      const tx2 = await db.startTransaction()
      await tx2.collection('configs').doc('child-ok').set({ data: { key: 'child-ok', value: 4 } })
      await tx2.commit()
    })
    assert.equal((await db.collection('configs').where({ key: db.command.in(['parent', 'child-ok']) }).count()).total, 2)
    assert.equal((await db.collection('configs').where({ key: db.command.in(['child', 'child-failed']) }).count()).total, 0)
  })

  await t.test('concurrent read/update flows serialize without lost updates or duplicate sign-in', async () => {
    const before = (await db.collection('users').doc('worker').get()).data.points
    await Promise.all(Array.from({ length: 8 }, () => db.runInTransaction(async () => {
      const user = (await db.collection('users').doc('worker').get()).data
      await db.collection('users').doc('worker').update({ data: { points: user.points + 1 } })
    })))
    assert.equal((await db.collection('users').doc('worker').get()).data.points, before + 8)
    const claims = await Promise.all(Array.from({ length: 6 }, () => db.runInTransaction(async () => {
      const result = await db.collection('users').where({ _id: 'worker', lastSignDate: db.command.neq('2026-11-13') })
        .update({ data: { lastSignDate: '2026-11-13', points: db.command.inc(2) } })
      return result.stats.updated
    })))
    assert.equal(claims.reduce((sum, claim) => sum + claim, 0), 1)
  })

  await t.test('unique relations and foreign keys reject invalid records without partial writes', async () => {
    await db.collection('favorites').add({ data: { openid: 'worker-openid', jobId: 'job-a' } })
    await assert.rejects(db.collection('favorites').add({ data: { openid: 'worker-openid', jobId: 'job-a' } }), { code: '23505' })
    await assert.rejects(db.collection('favorites').add({ data: { openid: 'worker-openid', jobId: 'does-not-exist' } }), { code: '23503' })
    assert.equal((await db.collection('favorites').count()).total, 1)
    await assert.rejects(db.collection('users').doc('worker').update({ data: { points: -1 } }), { code: '23514' })
    assert.ok((await db.collection('users').doc('worker').get()).data.points >= 0)
  })

  await t.test('duplicate payment callbacks credit balance and create a ledger entry exactly once', async () => {
    await db.collection('orders').add({ data: { _id: 'order', outTradeNo: 'trade-1', openid: 'worker-openid', amount: 12.5, fen: 1250 } })
    const before = (await db.collection('users').doc('worker').get()).data.balance
    async function callback() {
      const tx = await db.startTransaction()
      try {
        const order = (await tx.collection('orders').doc('order').get()).data
        if (order.status === 'paid') { await tx.rollback(); return false }
        await tx.collection('orders').doc('order').update({ data: { status: 'paid', paidAt: now, transactionId: 'wx-1', raw: { verified: true } } })
        await tx.collection('users').doc('worker').update({ data: { balance: db.command.inc(order.amount) } })
        await tx.collection('wallet').add({ data: { openid: 'worker-openid', type: 3, amount: order.amount, businessType: '充值', businessId: order.outTradeNo } })
        await tx.commit()
        return true
      } catch (error) { await tx.rollback(); throw error }
    }
    const paid = await Promise.all(Array.from({ length: 5 }, callback))
    assert.equal(paid.filter(Boolean).length, 1)
    assert.equal((await db.collection('users').doc('worker').get()).data.balance, before + 12.5)
    assert.equal((await db.collection('wallet').where({ businessId: 'trade-1' }).count()).total, 1)
    assert.deepEqual((await db.collection('orders').doc('order').get()).data.raw, { verified: true })
  })
})
