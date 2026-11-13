import api from '@/api/index.js'

let cached
let pending
export function loadRegions() {
  if (cached) return Promise.resolve(cached)
  if (!pending)
    pending = api
      .getRegions()
      .then((res) => {
        if (!Array.isArray(res.data) || !res.data.length) throw new Error('地区数据为空')
        cached = res.data
        return cached
      })
      .finally(() => {
        pending = null
      })
  return pending
}

export function regionOptions(tree, allowAll) {
  if (!allowAll) return tree
  const options = tree.map((province) => ({
    ...province,
    children: [
      { text: /市$/.test(province.text) ? '全市' : '全省', value: `${province.value}-all` },
      ...(province.children || []).map((city) => ({
        ...city,
        children: city.children?.length
          ? [{ text: '全市', value: `${city.value}-all` }, ...city.children]
          : undefined
      }))
    ]
  }))
  return [{ text: '全国', value: 'all' }, ...options]
}

export function selectedRegionCode(tree, names, allowAll, address = '') {
  if (!names.length && address) {
    for (const province of tree) {
      const city = (province.children || []).find((node) =>
        address.includes(node.text.replace(/市$/, ''))
      )
      if (!city) continue
      const district = (city.children || []).find((node) =>
        address.includes(node.text.replace(/[区县市]$/, ''))
      )
      names = [province.text, city.text, ...(district ? [district.text] : [])]
      break
    }
  }
  let nodes = tree
  let last
  for (const name of names) {
    const found = nodes.find((node) => node.text === name)
    if (!found) break
    last = found
    nodes = found.children || []
  }
  if (!last) return allowAll ? 'all' : ''
  return allowAll && nodes.length ? `${last.value}-all` : last.value
}

export function pickerData(tree, selectedCode) {
  const treeData = []
  let selected = []
  function visit(nodes, parents = []) {
    for (const { children, ...node } of nodes) {
      treeData.push({
        ...node,
        parent_value: parents.length ? parents[parents.length - 1].value : null
      })
      const path = [...parents, node]
      if (node.value === selectedCode) selected = path
      if (children?.length) visit(children, path)
    }
  }
  visit(tree)
  return { treeData, selected }
}
