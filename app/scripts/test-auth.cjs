const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

// Exercise the actual navigation/session module with the uni runtime boundary stubbed.
const source = fs
  .readFileSync(path.join(__dirname, '../src/utils/auth.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
const navigation = fs
  .readFileSync(path.join(__dirname, '../src/utils/navigation.js'), 'utf8')
  .replace(/^export /gm, '')

function runtime(pages = [{ route: 'pages/mine/mine' }]) {
  const storage = new Map()
  const calls = []
  const state = { userInfo: null, userType: '', authReady: true }
  const context = vm.createContext({
    store: {
      state,
      commit(name, value) {
        state[name === 'setUserInfo' ? 'userInfo' : 'userType'] = value
      }
    },
    getCurrentPages: () => pages,
    uni: {
      getStorageSync: (key) => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: (key) => storage.delete(key),
      navigateTo: (options) => calls.push({ method: 'navigateTo', ...options }),
      navigateBack: () => calls.push({ method: 'navigateBack' }),
      redirectTo: (options) => calls.push({ method: 'redirectTo', ...options }),
      switchTab: (options) => calls.push({ method: 'switchTab', ...options }),
      showModal: (options) => calls.push({ method: 'showModal', ...options })
    }
  })
  vm.runInContext(navigation + '\n' + source, context)
  return { api: context, storage, calls, state }
}

test('login redirects allow internal pages and preserve encoded query values', () => {
  const { api } = runtime()
  const target = '/pages/jobDetail/jobDetail?id=a%26b&keyword=%E7%AE%A1%E5%B7%A5'
  assert.equal(api.safeReturnUrl(encodeURIComponent(target)), target)
  for (const value of [
    undefined,
    'https://outside.invalid',
    '//outside.invalid',
    '%ZZ',
    '/pages/login/login',
    '/pages/../login'
  ]) {
    assert.equal(api.safeReturnUrl(value), '/pages/index/index')
  }
})

test('login returns to an existing detail page without losing its query', () => {
  const { api, calls } = runtime([
    { route: 'pages/jobDetail/jobDetail', options: { id: 'a&b' } },
    { route: 'pages/login/login' }
  ])
  api.finishLogin('/pages/jobDetail/jobDetail?id=a%26b')
  assert.equal(calls[0].method, 'navigateBack')
})

test('direct login uses tab navigation or redirects to a secondary page', () => {
  const { api, calls } = runtime([{ route: 'pages/login/login' }])
  api.finishLogin('/pages/publish/index')
  api.finishLogin('/pages/resume/edit?from=mine')
  assert.equal(calls[0].method, 'switchTab')
  assert.equal(calls[0].url, '/pages/publish/index')
  assert.equal(calls[1].method, 'redirectTo')
  assert.equal(calls[1].url, '/pages/resume/edit?from=mine')
})

test('session logout clears persisted identity and reactive state together', () => {
  const { api, storage, state } = runtime()
  api.setUser({ id: 'worker-1', userType: 'worker' })
  storage.set('token', 'test-token')
  assert.equal(api.isLoggedIn(), true)
  assert.equal(state.userType, 'worker')
  api.clearAuth()
  assert.equal(api.isLoggedIn(), false)
  assert.equal(state.userInfo, null)
  assert.equal(state.userType, '')
  assert.equal(storage.has('token'), false)
  assert.equal(storage.has('ghq_user'), false)
})

test('concurrent authentication failures show one prompt and capture the original page', () => {
  const { api, calls } = runtime([{ route: 'pages/resume/edit', options: { from: 'mine' } }])
  api.promptLogin()
  api.promptLogin()
  assert.equal(calls.length, 1)
  calls[0].success({ confirm: true })
  assert.equal(
    calls[1].url,
    '/pages/login/login?redirect=' + encodeURIComponent('/pages/resume/edit?from=mine')
  )
  api.goLogin()
  assert.equal(calls.length, 2)
})

test('the login page cannot prompt or navigate to itself', () => {
  const { api, calls } = runtime([{ route: 'pages/login/login' }])
  api.promptLogin()
  api.goLogin()
  assert.equal(calls.length, 0)
})
