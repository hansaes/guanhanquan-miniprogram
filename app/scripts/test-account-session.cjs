const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function accountRuntime() {
  let resolve, reject
  const pending = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  const session = { authReady: true, userInfo: { id: 'previous-user' } }
  const writes = []
  const context = vm.createContext({
    content: {},
    session,
    mapState: () => ({}),
    mapMutations: () => ({}),
    api: { getUserProfile: () => pending, getWallet: () => pending },
    setUser: (user) => writes.push(user),
    clearAuth: () => {
      session.userInfo = null
    }
  })
  const script = fs
    .readFileSync(path.join(__dirname, '../src/pages/mine/mine.vue'), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '')
    .replace('export default', 'var component =')
  vm.runInContext(script, context)
  const page = context.component.data()
  page.localUser = session.userInfo
  page.setUserInfo = (user) => {
    session.userInfo = user
  }
  Object.entries(context.component.methods).forEach(([name, fn]) => {
    page[name] = fn.bind(page)
  })
  return { page, session, writes, resolve, reject }
}

test('a profile response arriving after logout cannot restore the session', async () => {
  const { page, session, writes, resolve } = accountRuntime()
  const request = page.refreshProfile()
  session.userInfo = null
  resolve({ data: { id: 'previous-user', nickname: '旧资料' } })
  await request
  assert.equal(session.userInfo, null)
  assert.equal(writes.length, 0)
})

test('an old profile failure cannot clear a newly signed-in account', async () => {
  const { page, session, reject } = accountRuntime()
  const request = page.refreshProfile()
  session.userInfo = { id: 'current-user' }
  reject({ code: 403 })
  await request
  assert.equal(session.userInfo.id, 'current-user')
})

test('a wallet failure from an old session does not mark the new account as failed', async () => {
  const { page, session, reject } = accountRuntime()
  const request = page.loadWallet()
  session.userInfo = { id: 'current-user' }
  reject(new Error('Previous request failed'))
  await request
  assert.equal(page.walletError, false)
  assert.equal(page.walletReady, false)
  assert.equal(page.walletLoading, false)
})
