<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onBeforeRouteLeave } from 'vue-router'
import api from '@/api/guanhanquan'

const fields = ref([]), values = ref({}), saved = ref({}), loading = ref(false), saving = ref(false), error = ref(''), saveError = ref('')
const dirty = computed(() => fields.value.some(field => values.value[field.key] !== saved.value[field.key]))
const groups = computed(() => [
  { title: '积分费用', description: '用户使用平台服务时扣除的积分', fields: fields.value.filter(field => field.unit === '积分' && !field.key.endsWith('Points')) },
  { title: '任务奖励', description: '用户完成任务后获得的积分', fields: fields.value.filter(field => field.key.endsWith('Points')) },
  { title: '有效期限', description: '招工信息与置顶服务的有效天数', fields: fields.value.filter(field => field.unit !== '积分') }
])
async function load() {
  loading.value = true
  error.value = ''
  try {
    fields.value = await api.settings()
    values.value = Object.fromEntries(fields.value.map(field => [field.key, field.value]))
    saved.value = { ...values.value }
  } catch (cause) { error.value = cause.message } finally { loading.value = false }
}
async function save() {
  if (saving.value || loading.value || !dirty.value) return
  saving.value = true
  saveError.value = ''
  try {
    for (const field of fields.value) if (!Number.isSafeInteger(values.value[field.key]) || values.value[field.key] < field.min || values.value[field.key] > field.max) throw new Error(`${field.label}必须为 ${field.min} 至 ${field.max} 的整数`)
    try { await ElMessageBox.confirm('新配置将应用于后续操作，已发生的扣费与奖励保留。', '保存费用配置', { confirmButtonText: '保存', cancelButtonText: '取消', type: 'warning' }) } catch { return }
    await api.saveSettings(values.value)
    saved.value = { ...values.value }
    ElMessage.success('配置已保存')
  } catch (cause) { saveError.value = cause.message } finally { saving.value = false }
}
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  try { await ElMessageBox.confirm('有尚未保存的费用配置，离开后将丢失。', '离开页面', { confirmButtonText: '离开', cancelButtonText: '继续编辑', type: 'warning' }); return true }
  catch { return false }
})
onMounted(load)
</script>

<template>
  <div class="settings-page" v-loading="loading">
    <header class="business-heading">
      <div><h2>费用与奖励</h2><p>管理积分规则与招工有效期</p></div>
      <div class="heading-actions">
        <el-tag v-if="dirty" type="warning" effect="plain">有未保存的修改</el-tag>
        <el-button :disabled="saving || loading" @click="values = { ...saved }">重置修改</el-button>
        <el-button type="primary" :loading="saving" :disabled="loading || !!error || !dirty" @click="save">保存配置</el-button>
      </div>
    </header>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false"><el-button link @click="load">重新加载</el-button></el-alert>
    <el-alert v-if="saveError" :title="saveError" type="error" show-icon :closable="false" />
    <div v-if="fields.length" class="settings-grid">
      <el-card v-for="group in groups" :key="group.title" shadow="never" class="settings-card">
        <template #header><h3>{{ group.title }}</h3><p>{{ group.description }}</p></template>
        <el-form label-position="top" :disabled="saving" @submit.prevent="save">
          <el-form-item v-for="field in group.fields" :key="field.key" :label="field.label">
            <div class="field-value">
              <el-input-number v-model="values[field.key]" :aria-label="field.label" :min="field.min" :max="field.max" :precision="0" controls-position="right" />
              <span>{{ field.unit }}</span>
            </div>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
    <el-alert v-if="fields.length" class="settings-note" title="配置保存后对后续操作生效，修改记录可在操作日志中查看。" type="info" show-icon :closable="false" />
  </div>
</template>
<style scoped>
.business-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
h2 { font-size: 22px; font-weight: 600; margin: 0 0 6px; }
p { font-size: 13px; color: var(--el-text-color-secondary); margin: 0; line-height: 1.7; }
.heading-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.heading-actions .el-button + .el-button { margin: 0; }
.settings-grid { display: grid; grid-template-columns: 1.25fr 1fr 1fr; gap: 20px; }
.settings-card { border-radius: 10px; }
.settings-card h3 { font-size: 16px; font-weight: 600; margin: 0 0 6px; }
.settings-card :deep(.el-form-item) { margin-bottom: 24px; }
.settings-card :deep(.el-form-item:last-child) { margin-bottom: 0; }
.field-value { display: flex; align-items: center; gap: 12px; width: 100%; color: var(--el-text-color-secondary); }
.field-value .el-input-number { width: 100%; max-width: 240px; }
.field-value > span { flex-shrink: 0; }
.settings-note { margin-top: 20px; }
@media (max-width: 1100px) { .settings-grid { grid-template-columns: 1fr; } .settings-card :deep(.el-form) { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; } }
@media (max-width: 760px) { .business-heading { align-items: flex-start; flex-direction: column; } .settings-card :deep(.el-form) { display: block; } }
</style>
