const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function pageRuntime(file, response) {
  const calls = []
  const session = { authReady: true, userInfo: null }
  const script = fs.readFileSync(path.join(__dirname, '../src/pages', file), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '')
    .replace('export default', 'var page =')
  const context = vm.createContext({
    session, content: {}, dictionary: () => [],
    api: { getJobList(params) { calls.push(params); return response() } }
  })
  vm.runInContext(script, context)
  const component = context.page
  const page = component.data()
  Object.entries(component.methods).forEach(([name, fn]) => { page[name] = fn.bind(page) })
  Object.entries(component.computed).forEach(([name, fn]) => {
    Object.defineProperty(page, name, { get: fn.bind(page) })
  })
  page.metadataReady = true
  return { page, session, calls, component }
}

for (const file of ['index/index.vue', 'jobSearch/jobSearch.vue']) {
  test(file + ': guests and unverified sessions never request job records', async () => {
    const { page, session, calls } = pageRuntime(file, () => Promise.resolve({ data: { records: [], total: 0 } }))
    await page.reload()
    session.userInfo = { id: 'worker' }
    session.authReady = false
    await page.reload()
    assert.equal(calls.length, 0)
    session.authReady = true
    page.keyword = '管工'
    await page.reload()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].keyword, '管工')
  })

  test(file + ': logout clears loaded records and discards an in-flight response', async () => {
    let resolve
    const { page, session, component } = pageRuntime(file, () => new Promise(done => { resolve = done }))
    session.userInfo = { id: 'worker' }
    const field = file.startsWith('index/') ? 'jobs' : 'list'
    page[field] = [{ id: 'old-job' }]
    const request = page.reload()
    session.userInfo = null
    component.watch.authenticated.call(page, false)
    assert.equal(page[field].length, 0)
    assert.equal(page.total, 0)
    resolve({ data: { records: [{ id: 'late-job' }], total: 1 } })
    await request
    assert.equal(page[field].length, 0)
    assert.equal(page.loading, false)
    assert.equal(page.error, '')
  })
}
