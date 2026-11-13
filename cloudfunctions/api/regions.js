// Administrative data: @vant/area-data 2.2.0 (MIT); see data/README.md.
const area = require('./data/area-list.json')
const paths = new Map()
const provinces = Object.entries(area.province_list).map(([value, text]) => ({
  value,
  text,
  children: []
}))
const byProvince = new Map(provinces.map((node) => [node.value.slice(0, 2), node]))
const byCity = new Map()
for (const [value, text] of Object.entries(area.city_list)) {
  const province = byProvince.get(value.slice(0, 2))
  if (!province) continue
  const city = { value, text, children: [] }
  province.children.push(city)
  byCity.set(value.slice(0, 4), city)
}
for (const [value, text] of Object.entries(area.county_list)) {
  const city = byCity.get(value.slice(0, 4))
  if (city) city.children.push({ value, text })
}
function index(nodes, parents = []) {
  for (const node of nodes) {
    const path = [...parents, node]
    paths.set(node.value, path)
    if (node.children?.length) index(node.children, path)
    else delete node.children
  }
}
index(provinces)

const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function filterPattern(code) {
  const path = paths.get(String(code))
  if (!path) return null
  // Older jobs saved city + district without province. Include the province's cities.
  if (path.length === 1) {
    const names = [
      path[0].text,
      ...(path[0].children || []).map((node) => node.text.replace(/市$/, ''))
    ]
    return `(?:${[...new Set(names)].map(escape).join('|')})`
  }
  return path
    .slice(1)
    .map((node, i) => {
      const name = i === 0 ? node.text.replace(/市$/, '') : node.text.replace(/[区县市]$/, '')
      return escape(name)
    })
    .join('.*')
}

exports.tree = provinces
exports.filterPattern = filterPattern
