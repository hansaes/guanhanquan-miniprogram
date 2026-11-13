const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function runtime(file, api) {
  const session = { authReady: true, userInfo: { id: 'employer-a' } }
  const modals = []
  const context = vm.createContext({
    api,
    session,
    salaryText: () => '',
    uni: {
      showModal: (value) => modals.push(value),
      showToast: () => {}
    }
  })
  const script = fs
    .readFileSync(path.join(__dirname, '../src/pages/employer', file), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '')
    .replace('export default', 'var component =')
  vm.runInContext(script, context)
  const page = context.component.data()
  for (const [name, fn] of Object.entries(context.component.methods)) page[name] = fn.bind(page)
  return { page, session, modals }
}

test('unavailable fees stay unknown and cannot open a charge confirmation', async () => {
  const { page, modals } = runtime('jobManage.vue', {
    getEmployerJobs: async () => ({ data: { records: [{ id: 'job' }] } }),
    getWallet: async () => {
      throw new Error('offline')
    }
  })
  await page.load()
  assert.equal(page.jobs.length, 1)
  assert.equal(page.walletError, true)
  assert.equal(page.wallet.topCost, null)
  page.promote({ id: 'job' })
  page.refresh({ id: 'job' })
  assert.equal(modals.length, 0)
})

test('zero fees are preserved and failed job requests expose a retryable error', async () => {
  const { page } = runtime('jobManage.vue', {
    getEmployerJobs: async () => {
      throw new Error('offline')
    },
    getWallet: async () => ({ data: { topCost: 0, refreshCost: 0 } })
  })
  await page.load()
  assert.equal(page.wallet.topCost, 0)
  assert.equal(page.wallet.refreshCost, 0)
  assert.equal(page.walletError, false)
  assert.ok(page.error)
  assert.equal(page.loading, false)
})

test('repeated paid actions share one confirmation and cannot charge after logout', async () => {
  let charges = 0
  const { page, session, modals } = runtime('jobManage.vue', {
    topJob: async () => {
      charges++
    }
  })
  page.wallet.topCost = 0
  page.promote({ id: 'job' })
  page.promote({ id: 'job' })
  assert.equal(modals.length, 1)
  assert.equal(page.actionBusy, true)
  session.userInfo = null
  await modals[0].success({ confirm: true })
  assert.equal(charges, 0)
  assert.equal(page.actionBusy, false)
})

test('a changed resume search takes precedence over an in-flight search', async () => {
  const old = deferred(),
    current = deferred(),
    calls = []
  const { page } = runtime('resume/index.vue', {
    getWorkerList: (options) => {
      calls.push(options)
      return calls.length === 1 ? old.promise : current.promise
    }
  })
  page.keyword = '焊工'
  const first = page.reload()
  page.keyword = '管工'
  const second = page.reload()
  current.resolve({ data: { records: [{ id: 'current' }], total: 1 } })
  await second
  old.resolve({ data: { records: [{ id: 'old' }], total: 1 } })
  await first
  assert.equal(calls[1].keyword, '管工')
  assert.equal(page.list[0].id, 'current')
  assert.equal(page.page, 1)
})

test('resume pagination retains results and retries the same page and submitted query', async () => {
  const calls = []
  const { page } = runtime('resume/index.vue', {
    getWorkerList: async (options) => {
      calls.push(options)
      if (calls.length === 2) throw new Error('offline')
      return { data: { records: [{ id: calls.length === 1 ? 'first' : 'second' }], total: 2 } }
    }
  })
  page.keyword = '焊工'
  await page.reload()
  page.keyword = '尚未提交'
  await page.loadMore()
  assert.equal(page.page, 1)
  assert.equal(page.list[0].id, 'first')
  assert.ok(page.error)
  await page.loadMore()
  assert.equal(calls[1].page, 2)
  assert.equal(calls[2].page, 2)
  assert.equal(calls[2].keyword, '焊工')
  assert.equal(page.list.length, 2)
  assert.equal(page.hasMore, false)
  assert.equal(page.error, '')
})

test('a resume response from a previous account is discarded', async () => {
  const pending = deferred()
  const { page, session } = runtime('resume/index.vue', { getWorkerList: () => pending.promise })
  const request = page.reload()
  session.userInfo = { id: 'employer-b' }
  pending.resolve({ data: { records: [{ id: 'private' }], total: 1 } })
  await request
  assert.equal(page.list.length, 0)
})
