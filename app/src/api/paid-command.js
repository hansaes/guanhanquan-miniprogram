import { callApi } from './cloud.js'
import { getUser, promptLogin } from '@/utils/auth'

const inFlight = new Map()

function newKey() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2).padEnd(12, '0') + '_' + Math.random().toString(36).slice(2).padEnd(12, '0')
}

/**
 * Keep an unresolved intent across navigation/restarts. A timeout is not proof
 * of failure: the next attempt must retrieve the original server receipt.
 * @param {string} path
 * @param {Record<string, unknown>} [data]
 */
export function paidCommand(path, data = {}) {
  const user = getUser()
  if (!user?.id) {
    promptLogin()
    return Promise.reject({ code: 401, message: '请先登录' })
  }
  const slot = 'ghq.pendingCommand.' + encodeURIComponent(user.id) + '.' + encodeURIComponent(path)
  if (inFlight.has(slot)) return inFlight.get(slot)
  let key
  try {
    const saved = uni.getStorageSync(slot)
    key = saved?.key || newKey()
    uni.setStorageSync(slot, { key })
  } catch (cause) {
    uni.showToast({ title: '无法保存操作进度，请检查设备存储后重试', icon: 'none' })
    return Promise.reject(cause)
  }
  const clear = () => { try { uni.removeStorageSync(slot) } catch (_) {} }
  /** @type {import('../../../contracts/architecture-v1').PaidCommandInput} */
  const command = { idempotencyKey: key }
  const request = callApi(path, 'POST', { ...data, ...command }).then(result => {
    clear()
    return result
  }).catch(error => {
    const code = Number(error?.code)
    // Unknown/network/server outcomes retain the key. Definitive client failures
    // cannot have committed a charge and allow a corrected future command.
    if (code >= 400 && code < 500 && code !== 408 && code !== 429) clear()
    throw error
  }).finally(() => { inFlight.delete(slot) })
  inFlight.set(slot, request)
  return request
}
