<template>
  <div class="page-card">
    <div class="heading">
      <h3 class="page-title">{{ isTraining ? '培训课程' : '保险产品' }}</h3>
      <el-button type="primary" @click="open()">{{ isTraining ? '新增课程' : '新增保险' }}</el-button>
    </div>
    <el-form inline @submit.prevent="load(1)">
      <el-form-item label="名称"><el-input v-model="query.keyword" maxlength="100" clearable placeholder="搜索名称" @keyup.enter="load(1)" /></el-form-item>
      <el-form-item label="状态"><el-select v-model="query.enabled" clearable placeholder="全部" style="width: 120px" @change="load(1)"><el-option label="上架" value="true" /><el-option label="下架" value="false" /></el-select></el-form-item>
      <el-button type="primary" :loading="loading" @click="load(1)">查询</el-button>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button link @click="load()">重试</el-button></el-alert>
    <el-table :data="rows" v-loading="loading" :empty-text="error ? '加载失败' : '暂无产品'">
      <el-table-column :prop="isTraining ? 'title' : 'name'" label="名称" min-width="180" show-overflow-tooltip />
      <el-table-column v-if="isTraining" prop="teacher" label="讲师" min-width="100" />
      <el-table-column v-else prop="coverage" label="保障范围" min-width="160" show-overflow-tooltip />
      <el-table-column prop="price" label="价格（元）" width="120" />
      <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '上架' : '下架' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" min-width="230"><template #default="{ row }">
        <el-button link type="primary" @click="open(row)">编辑</el-button>
        <el-button link type="primary" @click="showHistory(row)">{{ isTraining ? '报名记录' : '购买记录' }}</el-button>
        <el-button v-if="row.enabled" link type="danger" :loading="deactivating === row.id" @click="deactivate(row)">下架</el-button>
      </template></el-table-column>
    </el-table>
    <el-pagination :current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" class="pagination" @current-change="load" />

    <el-dialog v-model="visible" :title="isTraining ? '课程信息' : '保险信息'" width="min(600px, 94vw)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />
      <el-form label-width="100px" :disabled="saving" @submit.prevent="save">
        <el-form-item label="名称" required><el-input v-if="isTraining" v-model="form.title" maxlength="100" /><el-input v-else v-model="form.name" maxlength="100" /></el-form-item>
        <template v-if="isTraining">
          <el-form-item label="讲师"><el-input v-model="form.teacher" maxlength="80" /></el-form-item>
          <el-form-item label="课程分类"><el-input v-model="form.type" maxlength="40" /></el-form-item>
          <el-form-item label="封面地址"><el-input v-model="form.cover" maxlength="1000" placeholder="HTTPS 或云存储地址" /></el-form-item>
        </template>
        <el-form-item v-else label="保障范围" required><el-input v-model="form.coverage" type="textarea" maxlength="500" :rows="2" /></el-form-item>
        <el-form-item label="价格（元）" required><el-input-number v-model="form.price" :min="0" :max="1000000" :precision="2" /></el-form-item>
        <el-form-item label="介绍"><el-input v-model="form.intro" type="textarea" :rows="4" maxlength="2000" show-word-limit /></el-form-item>
        <el-form-item label="上架"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>

    <el-drawer v-model="historyVisible" :title="`${historyTitle} · ${isTraining ? '报名记录' : '购买记录'}`" size="min(760px, 100vw)">
      <el-alert v-if="historyError" :title="historyError" type="error" :closable="false"><el-button link @click="loadHistory()">重试</el-button></el-alert>
      <el-table :data="historyRows" v-loading="historyLoading" :empty-text="historyError ? '加载失败' : '暂无记录'">
        <el-table-column prop="openid" label="用户标识" min-width="150" show-overflow-tooltip />
        <el-table-column prop="name" label="产品名称" min-width="160" show-overflow-tooltip />
        <el-table-column v-if="!isTraining" prop="price" label="支付金额（元）" width="130" />
        <el-table-column label="时间" min-width="170"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
      </el-table>
      <el-pagination :current-page="historyPage" :page-size="pageSize" :total="historyTotal" layout="total, prev, pager, next" class="pagination" @current-change="loadHistory" />
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api/guanhanquan'
import { usePagedList } from '@/composables/usePagedList'

const route = useRoute()
const kind = route.meta.productKind
const isTraining = computed(() => kind === 'trainings')
const query = reactive({ keyword: '', enabled: '' })
const { rows, total, page, pageSize, loading, error, load } = usePagedList((paging) => api.products(kind, { ...query, ...paging }))
const visible = ref(false), saving = ref(false), saveError = ref(''), editingId = ref(''), deactivating = ref(''), form = ref({})
const historyVisible = ref(false), historyId = ref(''), historyTitle = ref('')
const { rows: historyRows, total: historyTotal, page: historyPage, loading: historyLoading, error: historyError, load: loadHistory } = usePagedList((paging) => api.productHistory(kind, { ...paging, [isTraining.value ? 'trainingId' : 'insuranceId']: historyId.value }))
const formatTime = (value) => value ? new Date(value).toLocaleString('zh-CN') : '—'

function open(row) {
  editingId.value = row?.id || ''
  const defaults = isTraining.value ? { title: '', teacher: '', type: '', cover: '', intro: '', price: 0, enabled: false } : { name: '', coverage: '', intro: '', price: 0, enabled: false }
  form.value = Object.fromEntries(Object.keys(defaults).map((key) => [key, row?.[key] ?? defaults[key]]))
  saveError.value = ''
  visible.value = true
}
async function save() {
  if (saving.value) return
  saving.value = true
  saveError.value = ''
  try {
    if (!String(form.value[isTraining.value ? 'title' : 'name'] || '').trim()) throw new Error('请填写名称')
    if (!isTraining.value && !form.value.coverage.trim()) throw new Error('请填写保障范围')
    if (editingId.value) await api.updateProduct(kind, editingId.value, form.value)
    else await api.createProduct(kind, form.value)
    visible.value = false
    ElMessage.success('已保存')
    await load(editingId.value ? page.value : 1)
  } catch (cause) { saveError.value = cause.message } finally { saving.value = false }
}
async function deactivate(row) {
  if (deactivating.value) return
  try { await ElMessageBox.confirm('下架后将停止新的报名或购买，已有记录会保留。', '确认下架', { type: 'warning', confirmButtonText: '下架', cancelButtonText: '取消' }) } catch { return }
  deactivating.value = row.id
  try { await api.deactivateProduct(kind, row.id); ElMessage.success('已下架'); await load() } catch (cause) { ElMessage.error(cause.message) } finally { deactivating.value = '' }
}
function showHistory(row) {
  historyId.value = row.id
  historyTitle.value = row.title || row.name
  historyRows.value = []
  historyTotal.value = 0
  historyVisible.value = true
  loadHistory(1)
}
onMounted(() => load())
</script>

<style scoped>
.heading { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 20px; }
.heading .page-title { margin: 0; }
.pagination { margin-top: 20px; max-width: 100%; overflow: auto; }
.el-alert { margin-bottom: 16px; }
</style>
