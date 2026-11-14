<template>
  <div class="page-card">
    <h3 class="page-title">招工信息审核</h3>

    <el-form inline>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px" @change="load">
          <el-option label="待审核" :value="0" />
          <el-option label="已通过" :value="1" />
          <el-option label="已驳回" :value="4" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="岗位名称" clearable style="width: 200px" @keyup.enter="load" />
      </el-form-item>
      <el-button type="primary" @click="load">查询</el-button>
    </el-form>

    <el-table :data="rows" v-loading="loading" border stripe>
      <el-table-column prop="title" label="岗位" width="120" />
      <el-table-column label="日薪" width="100">
        <template #default="{ row }">{{ salaryText(row) }}</template>
      </el-table-column>
      <el-table-column prop="workArea" label="工作地区" min-width="140" />
      <el-table-column prop="contactName" label="联系人" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 0">
            <el-button size="small" type="success" :loading="reviewingId === row.id" :disabled="!!reviewingId" @click="review(row, true)">通过</el-button>
            <el-button size="small" type="danger" :disabled="!!reviewingId" @click="askReject(row)">驳回</el-button>
          </template>
          <span v-else-if="row.status === 4" class="reason">{{ row.rejectReason || '已驳回' }}</span>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      :page-size="query.pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top: 16px"
      @current-change="load"
    />

    <el-dialog v-model="rejectVisible" title="驳回原因" width="420px" :close-on-click-modal="!reviewingId" :close-on-press-escape="!reviewingId" :show-close="!reviewingId">
      <el-input v-model="rejectReason" type="textarea" :rows="4" placeholder="填写驳回原因，会通知发布者" />
      <template #footer>
        <el-button :disabled="!!reviewingId" @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="!!reviewingId" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api/guanhanquan'
import type { ReviewableJob, ReviewJobInput } from '../../../../contracts/architecture-v1'

const rows = ref<ReviewableJob[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ status: 0, keyword: '', page: 1, pageSize: 20 })
const rejectVisible = ref(false)
const rejectReason = ref('')
const current = ref<ReviewableJob | null>(null)
const reviewingId = ref('')
let sequence = 0

const statusText = (s: number) => ({ 0: '待审核', 1: '已通过', 2: '已下架', 3: '已过期', 4: '已驳回', 5: '已删除' }[s] || '未知')
const statusType = (s: number): 'warning' | 'success' | 'info' | 'danger' => ({ 0: 'warning', 1: 'success', 2: 'info', 3: 'info', 4: 'danger', 5: 'info' } as const)[s] || 'info'
const fmt = (ts: number) => (ts ? new Date(ts).toLocaleString('zh-CN') : '-')
const UNITS = { 1: '元/天', 2: '元/小时', 3: '元/月', 4: '面议' }
function salaryText(row: ReviewableJob) {
  if (!row) return ''
  const unit = Number(row.salaryUnit || 1)
  if (unit === 4) return '面议'
  return (row.salary || 0) + (UNITS[unit] || '元/天')
}

async function load() {
  const request = ++sequence
  loading.value = true
  try {
    const data = await api.jobs(query)
    if (request !== sequence) return
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    if (request === sequence) ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    if (request === sequence) loading.value = false
  }
}

async function review(row: ReviewableJob, pass: boolean, reason = '') {
  if (reviewingId.value) return
  reviewingId.value = row.id
  try {
    const input: ReviewJobInput = { pass, expectedVersion: row.version, ...(pass ? {} : { reason: reason.trim() }) }
    await api.reviewJob(row.id, input)
    ElMessage.success(pass ? '已通过' : '已驳回')
    rejectVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '审核失败')
    if (Number((e as { code?: number })?.code) === 409) {
      rejectVisible.value = false
      current.value = null
      await load()
    }
  } finally {
    reviewingId.value = ''
  }
}

function askReject(row: ReviewableJob) {
  if (reviewingId.value) return
  current.value = { ...row }
  rejectReason.value = ''
  rejectVisible.value = true
}

async function confirmReject() {
  if (!current.value || reviewingId.value) return
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  await review(current.value, false, rejectReason.value)
}

onMounted(load)
onBeforeUnmount(() => { sequence++ })
</script>

<style scoped>
.reason { color: #909399; font-size: 12px; }
</style>
