import { labelFor } from './content'

export function salaryText(job) {
  if (!job) return ''
  const unit = Number(job.salaryUnit || 1)
  if (unit === 4) return '面议'
  const amount = job.salary === undefined || job.salary === null || job.salary === '' ? '面议' : job.salary
  return amount === '面议' ? '面议' : amount + labelFor('salaryUnits', unit, { 1: '元/天', 2: '元/小时', 3: '元/月' }[unit] || '')
}

export function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const hour = 3600 * 1000
  if (diff < hour) return '刚刚'
  if (diff < 24 * hour) return Math.floor(diff / hour) + ' 小时前'
  if (diff < 7 * 24 * hour) return Math.floor(diff / (24 * hour)) + ' 天前'
  const d = new Date(ts)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}
