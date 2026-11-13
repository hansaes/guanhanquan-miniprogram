const tabs = ['/pages/index/index', '/pages/publish/index', '/pages/mine/mine']
export function isTabPage(url) {
  return tabs.includes(url.split('?')[0])
}
export function navigate(url) {
  if (!url || !/^\/pages\/[\w/-]+(?:\?.*)?$/.test(url)) return
  const path = url.split('?')[0]
  if (tabs.includes(path)) return uni.switchTab({ url: path })
  return uni.navigateTo({ url })
}
