import { reactive } from 'vue'
import api from '@/api/index.js'

// 业务内容来自云端；仅保留空结构，避免前后端维护两套默认标签。
export const content = reactive({
  brandName: '',
  searchPlaceholder: '',
  safetyNotice: '',
  badges: {},
  tabs: [],
  shortcuts: [],
  dictionaries: {},
  services: [],
  faqs: []
})
let pending
let loadedAt = 0
export function loadContent(force = false) {
  if (pending) return pending
  if (!force && Date.now() - loadedAt < 60000) return Promise.resolve(content)
  pending = api
    .getUiContent()
    .then((res) => {
      Object.assign(content, res.data)
      loadedAt = Date.now()
      return content
    })
    .finally(() => {
      pending = null
    })
  return pending
}
export function dictionary(key) {
  return content.dictionaries[key] || []
}
export function indexFor(key, value) {
  return Math.max(
    0,
    dictionary(key).findIndex((x) => String(x.value) === String(value))
  )
}
export function labelFor(key, value, fallback = '') {
  const item = dictionary(key).find((x) => String(x.value) === String(value))
  return item ? item.label : fallback
}
