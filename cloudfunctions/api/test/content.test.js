const assert = require('node:assert/strict')
process.env.ADMIN_INIT_PASSWORD = 'content-test-pass'
const mock = require('./mock-cloud')
const { handle } = require('../router')
const L = require('../lib')
const call = (method, path, data = {}, token = '', openid = '') =>
  handle({ method, path, data, token, openid, cloud: mock.fakeSdk })

async function main() {
  mock.reset()
  const login = await call('POST', '/admin/login', {
    username: 'admin',
    password: 'content-test-pass'
  })
  const token = login.data.token
  assert.equal((await call('GET', '/admin/content')).code, 401)
  const initial = (await call('GET', '/content/ui')).data
  assert.deepEqual(initial.tabs, ['首页', '发布招工', '我的'])
  await L.setConfig('uiContent', { tabs: ['找活', '发招工', '求职', '个人中心'] })
  assert.deepEqual((await call('GET', '/content/ui')).data.tabs, ['找活', '发招工', '个人中心'])
  assert.deepEqual((await call('GET', '/admin/content', {}, token)).data.tabs, ['找活', '发招工', '个人中心'])
  const changed = JSON.parse(JSON.stringify(initial))
  changed.badges.urgent = '急聘'
  changed.tabs = ['找活', '发招工', '求职', '个人中心']
  changed.shortcuts[0].enabled = false
  changed.services[0].path = '/pages/unknown/page'
  changed.dictionaries.payTypes.reverse()
  changed.dictionaries.payTypes.find((x) => x.value === 2).label = '按月结算'
  assert.equal((await call('PUT', '/admin/content', changed)).code, 401)
  assert.equal((await call('PUT', '/admin/content', changed, token)).success, true)
  const live = (await call('GET', '/content/ui')).data
  assert.equal(live.badges.urgent, '急聘')
  assert.deepEqual(live.tabs, ['找活', '发招工', '个人中心'])
  const updated = { ...changed, tabs: ['首页', '发布', '我的'] }
  assert.equal((await call('PUT', '/admin/content', updated, token)).success, true)
  assert.deepEqual((await call('GET', '/content/ui')).data.tabs, updated.tabs)
  assert.equal((await call('PUT', '/admin/content', { ...updated, tabs: ['首页'] }, token)).success, false)
  assert.equal(live.shortcuts.length, 3)
  assert.equal(live.services[0].path, '/pages/mine/certification')
  assert.equal(live.dictionaries.payTypes.find((x) => x.value === 2).label, '按月结算')
  assert.equal((await call('GET', '/admin/content', {}, token)).data.shortcuts.length, 4)
  const invalid = JSON.parse(JSON.stringify(changed))
  invalid.dictionaries.payTypes[0].value = 999
  assert.equal((await call('PUT', '/admin/content', invalid, token)).success, false)
  assert.equal((await call('GET', '/content/ui')).data.dictionaries.payTypes[0].value, 5)
  assert.equal(
    (
      await call(
        'POST',
        '/admin/categories',
        { id: 'hanjie', name: '焊接工', sort: 2, enabled: true },
        token
      )
    ).success,
    true
  )
  let categories = (await call('GET', '/categories/list')).data
  assert.equal(categories.length, 7)
  assert.equal(categories.find((x) => x.id === 'hanjie').name, '焊接工')
  assert.ok(categories.find((x) => x.id === 'hanjie').aliases.includes('焊工'))
  await L.db()
    .collection('resumes')
    .add({
      data: {
        name: '历史简历',
        jobTypes: ['焊工'],
        status: 0,
        reviewStatus: 1
      }
    })
  assert.equal((await call('GET', '/categories/workers/list/hanjie')).data.total, 1)
  await call(
    'POST',
    '/admin/categories',
    { id: 'hanjie', name: '焊接工', sort: 2, enabled: false },
    token
  )
  assert.equal(
    (await call('GET', '/categories/list')).data.some((x) => x.id === 'hanjie'),
    false
  )
  assert.equal((await call('GET', '/admin/categories', {}, token)).data.length, 7)
  await L.db()
    .collection('jobs')
    .add({
      data: {
        title: '老数据日薪',
        salary: 600,
        status: 1,
        expireAt: Date.now() + 86400000,
        employerVerified: true
      }
    })
  await L.db()
    .collection('jobs')
    .add({
      data: {
        title: '月薪',
        salary: 18000,
        salaryUnit: 3,
        status: 1,
        expireAt: Date.now() + 86400000
      }
    })
  const salaries = (await call('GET', '/jobs/list', { sort: 'salary', minSalary: 500 }, '', 'reader')).data
    .records
  assert.equal(salaries.length, 1)
  assert.equal(salaries[0].title, '老数据日薪')
  assert.equal((await call('GET', '/jobs/list', { verified: true }, '', 'reader')).data.records.length, 1)
  console.log(
    'Content configuration, permissions, stable enums, category aliases and salary filtering: passed'
  )
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
