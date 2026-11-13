const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function walletRuntime(api) {
  const session = { userInfo: { id: 'worker' } }
  const context = vm.createContext({ api, session, uni: { showToast() {} } })
  const script = fs
    .readFileSync(path.join(__dirname, '../src/pages/wallet/index.vue'), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '')
    .replace('export default', 'var component =')
  vm.runInContext(script, context)
  const page = context.component.data()
  Object.entries(context.component.methods).forEach(([name, fn]) => {
    page[name] = fn.bind(page)
  })
  return { page, session }
}

test('failed wallet requests preserve unknown values and expose separate retry states', async () => {
  const fail = async () => {
    throw new Error('offline')
  }
  const { page } = walletRuntime({ getWallet: fail, getWalletRecords: fail })
  assert.equal(page.info, null)
  await page.load()
  assert.equal(page.info, null)
  assert.ok(page.err)
  assert.ok(page.recordsError)
  assert.equal(page.loading, false)
  assert.equal(page.recordsLoading, false)
})

test('records failure does not hide a successfully loaded wallet', async () => {
  const { page } = walletRuntime({
    getWallet: async () => ({ data: { points: 10, balance: 23.5 } }),
    getWalletRecords: async () => {
      throw new Error('offline')
    }
  })
  await page.load()
  assert.equal(page.info.balance, 23.5)
  assert.equal(page.err, '')
  assert.ok(page.recordsError)
})

test('old wallet responses cannot populate a different session', async () => {
  let resolve
  const pending = new Promise((done) => {
    resolve = done
  })
  const { page, session } = walletRuntime({
    getWallet: () => pending,
    getWalletRecords: async () => ({ data: { records: [] } })
  })
  const request = page.load()
  session.userInfo = { id: 'new-worker' }
  resolve({ data: { points: 99, balance: 100 } })
  await request
  assert.equal(page.info, null)
})

test('repeated sign-in taps submit one reward request', async () => {
  let resolve,
    calls = 0
  const pending = new Promise((done) => {
    resolve = done
  })
  const { page } = walletRuntime({
    signIn: () => {
      calls++
      return pending
    }
  })
  page.info = { points: 5, signedToday: false }
  page.load = async () => {}
  const request = page.signIn()
  await page.signIn()
  assert.equal(calls, 1)
  resolve({ data: { points: 2 } })
  await request
  assert.equal(page.info.signedToday, true)
  assert.equal(page.signing, false)
})
