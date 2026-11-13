import store from '@/store'
import { isTabPage } from './navigation'

const USER_KEY = 'ghq_user'
const TYPE_KEY = 'userType'
export const session = store.state

export function getUser() {
  try {
    return uni.getStorageSync(USER_KEY) || null
  } catch (e) {
    return null
  }
}

export function setUser(user) {
  if (!user) return clearAuth()
  store.commit('setUserInfo', user)
  if (user.userType) store.commit('setUserType', user.userType)
  try {
    uni.setStorageSync(USER_KEY, user)
    if (user.userType) uni.setStorageSync(TYPE_KEY, user.userType)
  } catch (e) {}
}

export function clearAuth() {
  store.commit('setUserInfo', null)
  store.commit('setUserType', '')
  try {
    uni.removeStorageSync(USER_KEY)
    uni.removeStorageSync(TYPE_KEY)
    uni.removeStorageSync('token')
    uni.removeStorageSync('ghq_employer')
  } catch (e) {}
}

export function isLoggedIn() {
  const u = session.userInfo
  return !!(u && u.id)
}

export function safeReturnUrl(value) {
  if (typeof value !== 'string') return '/pages/index/index'
  try {
    if (!value.startsWith('/')) value = decodeURIComponent(value)
  } catch {
    return '/pages/index/index'
  }
  if (
    !/^\/pages\/[\w/-]+(?:\?[^#]*)?$/.test(value) ||
    value.split('?')[0] === '/pages/login/login'
  ) {
    return '/pages/index/index'
  }
  return value
}

function pageUrl(page) {
  if (!page?.route) return '/pages/index/index'
  const query = Object.entries(page.options || {})
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
    .join('&')
  return '/' + page.route + (query ? '?' + query : '')
}

export function currentUrl() {
  const pages = getCurrentPages()
  return pageUrl(pages[pages.length - 1])
}

let openingLogin = false
export function goLogin(target = currentUrl()) {
  if (openingLogin || currentUrl().split('?')[0] === '/pages/login/login') return
  openingLogin = true
  uni.navigateTo({
    url: '/pages/login/login?redirect=' + encodeURIComponent(safeReturnUrl(target)),
    complete: () => {
      openingLogin = false
    }
  })
}

export function requireLogin(target) {
  if (isLoggedIn()) return true
  goLogin(target)
  return false
}

export function finishLogin(target) {
  const url = safeReturnUrl(target)
  const pages = getCurrentPages()
  if (pages.length > 1 && pageUrl(pages[pages.length - 2]) === url) {
    return uni.navigateBack()
  }
  if (isTabPage(url)) return uni.switchTab({ url: url.split('?')[0] })
  return uni.redirectTo({ url })
}

let loginPromptOpen = false
export function promptLogin() {
  if (loginPromptOpen || currentUrl().split('?')[0] === '/pages/login/login') return
  loginPromptOpen = true
  const target = currentUrl()
  uni.showModal({
    title: '请先登录',
    content: '登录后继续操作',
    confirmText: '去登录',
    success: ({ confirm }) => {
      if (confirm) goLogin(target)
    },
    complete: () => {
      loginPromptOpen = false
    }
  })
}

export function getUserType() {
  try {
    return uni.getStorageSync(TYPE_KEY) || ''
  } catch (e) {
    return ''
  }
}

export function setUserType(type) {
  try {
    uni.setStorageSync(TYPE_KEY, type)
  } catch (e) {}
}
