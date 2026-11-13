import { ref, onBeforeUnmount } from 'vue'

export function usePagedList(request) {
  const rows = ref([]), total = ref(0), page = ref(1), loading = ref(false), error = ref('')
  const pageSize = 20
  let sequence = 0
  async function load(nextPage = page.value) {
    const current = ++sequence
    loading.value = true
    error.value = ''
    try {
      const data = await request({ page: nextPage, pageSize })
      if (current !== sequence) return
      rows.value = data.records
      total.value = data.total
      page.value = nextPage
    } catch (cause) {
      if (current === sequence) error.value = cause.message || '加载失败，请重试'
    } finally {
      if (current === sequence) loading.value = false
    }
  }
  onBeforeUnmount(() => { sequence++ })
  return { rows, total, page, pageSize, loading, error, load }
}
