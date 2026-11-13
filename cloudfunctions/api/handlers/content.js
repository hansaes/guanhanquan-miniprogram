const L = require('../lib')
const { defaults } = require('../content')
const categories = require('./categories')

function normalizeTabs(tabs) {
  // 兼容四项导航的历史配置，保留仍在使用的运营名称。
  return Array.isArray(tabs) && tabs.length === 4 ? [tabs[0], tabs[1], tabs[3]] : tabs
}

async function load() {
  const saved = await L.getConfig('uiContent', {})
  return Object.assign({}, defaults, saved, {
    tabs: normalizeTabs(saved.tabs || defaults.tabs),
    badges: Object.assign({}, defaults.badges, saved.badges),
    dictionaries: Object.assign({}, defaults.dictionaries, saved.dictionaries)
  })
}

exports.publicContent = async () => {
  const content = await load()
  return L.ok(
    Object.assign({}, content, {
      shortcuts: content.shortcuts.filter((x) => x.enabled !== false),
      services: content.services.filter((x) => x.enabled !== false)
    })
  )
}
exports.get = async () => L.ok(await load())
exports.save = async (ctx) => {
  const data = { ...ctx.data, tabs: normalizeTabs(ctx.data.tabs) }
  if (JSON.stringify(data).length > 40000) return L.fail('内容过长')
  for (const key of ['brandName', 'searchPlaceholder', 'safetyNotice']) {
    if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > 200)
      return L.fail('请填写有效的' + key)
  }
  if (
    !Array.isArray(data.tabs) ||
    data.tabs.length !== defaults.tabs.length ||
    data.tabs.some((x) => typeof x !== 'string' || !x.trim() || x.length > 6)
  )
    return L.fail('导航名称需为 1–6 个字')
  if (
    !data.badges ||
    Object.keys(defaults.badges).some(
      (k) =>
        typeof data.badges[k] !== 'string' || !data.badges[k].trim() || data.badges[k].length > 8
    )
  )
    return L.fail('请填写标签名称，最多 8 个字')
  for (const key of ['shortcuts', 'services']) {
    if (!Array.isArray(data[key]) || data[key].length !== defaults[key].length)
      return L.fail('入口数据不完整')
    const seen = new Set()
    for (const row of data[key]) {
      const original = defaults[key].find((x) => x.value === row.value)
      if (
        !original ||
        seen.has(row.value) ||
        typeof row.label !== 'string' ||
        !row.label.trim() ||
        row.label.length > 12
      )
        return L.fail('入口名称或标识无效')
      seen.add(row.value)
      // 路由、图标与语义色由客户端支持范围决定，运营可改名、排序、上下架。
      Object.assign(row, {
        icon: original.icon,
        tone: original.tone,
        enabled: row.enabled !== false
      })
      if (original.path) row.path = original.path
      else delete row.path
    }
  }
  for (const [key, original] of Object.entries(defaults.dictionaries)) {
    const rows = data.dictionaries && data.dictionaries[key]
    if (!Array.isArray(rows) || !rows.length || rows.length > 40)
      return L.fail('选项不能为空：' + key)
    const seen = new Set()
    for (const row of rows) {
      if (
        !['string', 'number'].includes(typeof row.value) ||
        !String(row.value).trim() ||
        !row.label ||
        typeof row.label !== 'string' ||
        row.label.length > 40 ||
        seen.has(String(row.value))
      )
        return L.fail('选项无效或业务值重复：' + key)
      seen.add(String(row.value))
      if (
        key === 'salaryRanges' &&
        (!Number.isFinite(row.min) ||
          !Number.isFinite(row.max) ||
          row.min < 0 ||
          row.max < 0 ||
          (row.max && row.max < row.min))
      )
        return L.fail('薪资范围无效')
      if (
        key === 'timeRanges' &&
        (!Number.isFinite(row.value) || row.value < 0 || row.value > 8760)
      )
        return L.fail('时间范围无效')
    }
    if (
      [
        'salaryUnits',
        'payTypes',
        'accommodation',
        'travel',
        'reportTypes',
        'blacklistReasons'
      ].includes(key) &&
      (rows.length !== original.length ||
        original.some((x) => !rows.some((r) => r.value === x.value)))
    )
      return L.fail('固定业务选项只能调整名称和顺序：' + key)
  }
  if (
    !Array.isArray(data.faqs) ||
    data.faqs.length > 30 ||
    data.faqs.some(
      (f) =>
        typeof f.q !== 'string' ||
        !f.q.trim() ||
        f.q.length > 100 ||
        typeof f.a !== 'string' ||
        !f.a.trim() ||
        f.a.length > 600
    )
  )
    return L.fail('常见问题内容无效')
  const value = Object.fromEntries(Object.keys(defaults).map((k) => [k, data[k]]))
  await L.setConfig('uiContent', value)
  return L.ok(value)
}
exports.categories = async () => L.ok(await categories.loadCategories())
exports.saveCategory = async (ctx) => {
  const d = ctx.data
  if (
    !/^[a-zA-Z0-9_-]{1,40}$/.test(d.id || '') ||
    typeof d.name !== 'string' ||
    !d.name.trim() ||
    d.name.length > 20
  )
    return L.fail('请填写有效工种名称和标识')
  const value = {
    key: d.id,
    name: d.name.trim(),
    description: String(d.description || '').slice(0, 100),
    icon: '',
    sort: Number(d.sort) || 0,
    enabled: d.enabled !== false
  }
  // 首次管理时迁入默认工种，保留既有 ID，避免只保存一个工种后其余消失。
  const coll = L.db().collection('categories')
  const existing = await coll.limit(1).get()
  if (!existing.data.length) {
    for (const row of await categories.loadCategories()) {
      const { id, ...rest } = row
      await coll.doc(id).set({ data: Object.assign({}, rest, { enabled: true }) })
    }
  }
  const previous = await coll.doc(d.id).get().catch(() => null)
  if (previous && previous.data) {
    value.aliases = [...new Set([...(previous.data.aliases || []), previous.data.name])]
      .filter((name) => name && name !== value.name)
  }
  await coll.doc(d.id).set({ data: value })
  return L.ok(value)
}
