<template>
  <div class="page-card">
    <h3 class="page-title">黑名单申诉</h3>
    <el-form inline @submit.prevent="load(1)">
      <el-form-item label="审核状态"><el-select v-model="status" clearable placeholder="全部" style="width: 160px" @change="load(1)"><el-option v-for="(label, key) in statusLabels" :key="key" :label="label" :value="Number(key)" /></el-select></el-form-item>
      <el-button type="primary" :loading="loading" @click="load(1)">查询</el-button>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button link @click="load()">重试</el-button></el-alert>
    <el-table :data="rows" v-loading="loading" :empty-text="error ? '加载失败' : '暂无申诉'">
      <el-table-column prop="bossPhone" label="申诉号码" width="140" />
      <el-table-column prop="reason" label="申诉理由" min-width="240" show-overflow-tooltip />
      <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 2 ? 'success' : row.status === 3 ? 'info' : 'warning'">{{ statusLabels[row.status] }}</el-tag></template></el-table-column>
      <el-table-column label="提交时间" width="180"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
      <el-table-column label="操作" width="110"><template #default="{ row }"><el-button link type="primary" @click="open(row)">{{ row.status < 2 ? '审核' : '查看结果' }}</el-button></template></el-table-column>
    </el-table>
    <el-pagination :current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" class="pagination" @current-change="load" />
    <el-dialog v-model="visible" title="申诉详情" width="min(620px, 94vw)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <template v-if="selected">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="申诉号码">{{ selected.bossPhone }}</el-descriptions-item>
          <el-descriptions-item label="理由"><span class="long-text">{{ selected.reason }}</span></el-descriptions-item>
          <el-descriptions-item label="证据">
            <div v-if="selected.evidenceUrls.length" class="evidence"><el-image v-for="url in selected.evidenceUrls" :key="url" :src="url" :preview-src-list="selected.evidenceUrls" fit="cover" /></div>
            <span v-else>{{ selected.evidence.length ? '证据暂无法预览，请重新加载后核实' : '未提交证据' }}</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="selected.status >= 2" label="审核结果">{{ statusLabels[selected.status] }} · {{ formatTime(selected.handleTime) }}</el-descriptions-item>
          <el-descriptions-item v-if="selected.status >= 2" label="审核说明"><span class="long-text">{{ selected.handleRemark }}</span></el-descriptions-item>
        </el-descriptions>
        <el-form v-if="selected.status < 2" label-width="90px" class="review-form" :disabled="saving">
          <el-form-item label="审核结果" required><el-radio-group v-model="decision"><el-radio :value="2">通过并撤销标记</el-radio><el-radio :value="3">驳回申诉</el-radio></el-radio-group></el-form-item>
          <el-form-item label="审核说明" required><el-input v-model="remark" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="请输入核实结论，申诉人会收到通知" /></el-form-item>
        </el-form>
        <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />
      </template>
      <template #footer><el-button :disabled="saving" @click="visible = false">关闭</el-button><el-button v-if="selected?.status < 2" type="primary" :loading="saving" @click="review">提交审核</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api/guanhanquan'
import { usePagedList } from '@/composables/usePagedList'
const status = ref(0)
const statusLabels = { 0: '待审核', 1: '核实中', 2: '已通过', 3: '已驳回' }
const { rows, total, page, pageSize, loading, error, load } = usePagedList((paging) => api.appeals({ ...paging, status: status.value }))
const visible = ref(false), selected = ref(null), decision = ref(2), remark = ref(''), saving = ref(false), saveError = ref('')
const formatTime = (value) => value ? new Date(value).toLocaleString('zh-CN') : '—'
function open(row) { selected.value = row; decision.value = 2; remark.value = ''; saveError.value = ''; visible.value = true }
async function review() {
  if (saving.value) return
  saving.value = true
  saveError.value = ''
  try {
    if (remark.value.trim().length < 2) throw new Error('请填写至少 2 字的审核说明')
    const message = decision.value === 2 ? '通过后将撤销该号码已确认的黑名单标记，并通知申诉人。' : '驳回后将保留黑名单标记，并通知申诉人。'
    try { await ElMessageBox.confirm(message, '确认审核结果', { type: 'warning', confirmButtonText: '提交', cancelButtonText: '取消' }) } catch { return }
    const result = await api.reviewAppeal(selected.value.id, { status: decision.value, remark: remark.value.trim() })
    visible.value = false
    ElMessage.success(decision.value === 2 ? `已通过，撤销 ${result.revoked} 条标记` : '已驳回')
    await load()
  } catch (cause) { saveError.value = cause.message } finally { saving.value = false }
}
onMounted(() => load())
</script>
<style scoped>
.pagination { margin-top: 20px; max-width: 100%; overflow: auto; }
.el-alert { margin-bottom: 16px; }
.review-form { margin-top: 24px; }
.long-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.evidence { display: flex; flex-wrap: wrap; gap: 8px; }
.evidence .el-image { width: 72px; height: 72px; border-radius: 8px; }
</style>
