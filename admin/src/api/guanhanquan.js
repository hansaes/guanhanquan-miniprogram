import axios from 'axios'
import { sessionTokenKey, expireAdminSession } from '@/utils/admin-session'

const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '/api', timeout: 15000 })

function apiError(body, fallback) {
  return Object.assign(new Error(body?.message || fallback || '请求失败'), {
    code: Number(body?.code) || 0,
    errorCode: body?.errorCode || '',
    requestId: body?.requestId || ''
  })
}

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(sessionTokenKey)
  if (token && cfg.url !== '/admin/login') cfg.headers.Authorization = 'Bearer ' + token
  return cfg
})

http.interceptors.response.use(
  (res) => {
    const body = res.data
    if (!body || body.success !== true) {
      if (Number(body?.code) === 401 && res.config?.url !== '/admin/login') expireAdminSession()
      return Promise.reject(apiError(body))
    }
    return body.data
  },
  (err) => {
    if (err.response && err.response.status === 401 && err.config?.url !== '/admin/login') {
      expireAdminSession()
    }
    return Promise.reject(apiError(err.response?.data, err.message || '网络异常'))
  }
)

export const api = {
  products: (kind, params) => http.get(`/admin/${kind}`, { params }),
  createProduct: (kind, data) => http.post(`/admin/${kind}`, data),
  updateProduct: (kind, id, data) => http.put(`/admin/${kind}/${encodeURIComponent(id)}`, data),
  deactivateProduct: (kind, id) => http.delete(`/admin/${kind}/${encodeURIComponent(id)}`),
  productHistory: (kind, params) => http.get(kind === 'trainings' ? '/admin/training-enrollments' : '/admin/insurance-purchases', { params }),
  settings: () => http.get('/admin/settings'),
  saveSettings: (data) => http.put('/admin/settings', data),
  appeals: (params) => http.get('/admin/appeals', { params }),
  reviewAppeal: (id, data) => http.post(`/admin/appeals/${encodeURIComponent(id)}/review`, data),
  auditLogs: (params) => http.get('/admin/audit-logs', { params }),
  content: () => http.get('/admin/content'),
  saveContent: (data) => http.put('/admin/content', data),
  categories: () => http.get('/admin/categories'),
  saveCategory: (data) => http.post('/admin/categories', data),
  login: (data) => http.post('/admin/login', data),
  overview: () => http.get('/admin/overview'),

  jobs: (params) => http.get('/admin/jobs', { params }),
  /** @param {string} id @param {import('../../../contracts/architecture-v1').ReviewJobInput} data */
  reviewJob: (id, data) => http.post(`/admin/jobs/${encodeURIComponent(id)}/review`, data),

  users: (params) => http.get('/admin/users', { params }),
  userDetail: (id) => http.get(`/admin/users/${id}`),
  setUserStatus: (id, status) => http.post(`/admin/users/${id}/status`, { status }),

  verifications: (params) => http.get('/admin/verifications', { params }),
  reviewVerification: (id, data) => http.post(`/admin/verifications/${id}/review`, data),

  resumes: (params) => http.get('/admin/resumes', { params }),
  reviewResume: (id, data) => http.post(`/admin/resumes/${id}/review`, data),

  blacklist: (params) => http.get('/admin/blacklist', { params }),
  reviewBlacklist: (id, pass) => http.post(`/admin/blacklist/${id}/review`, { pass }),

  reports: (params) => http.get('/admin/reports', { params }),
  handleReport: (id, data) => http.post(`/admin/reports/${id}/handle`, data),

  announcements: () => http.get('/admin/announcements'),
  saveAnnouncement: (data) => http.post('/admin/announcements', data),
  deleteAnnouncement: (id) => http.delete(`/admin/announcements/${id}`),

  banners: () => http.get('/admin/banners'),
  saveBanner: (data) => http.post('/admin/banners', data),
  deleteBanner: (id) => http.delete(`/admin/banners/${id}`),

  finance: (params) => http.get('/admin/finance', { params }),

  feedback: (params) => http.get('/admin/feedback', { params }),
  handleFeedback: (id, data) => http.post(`/admin/feedback/${id}/handle`, data)
}

export default api
