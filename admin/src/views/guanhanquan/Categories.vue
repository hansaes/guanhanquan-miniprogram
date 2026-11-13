<template>
  <div class="page-card">
    <div class="heading">
      <h3 class="page-title">工种管理</h3>
      <el-button type="primary" @click="open()">新增工种</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="name" label="工种名称" />
      <el-table-column prop="id" label="业务标识" />
      <el-table-column prop="sort" label="排序" />
      <el-table-column label="状态">
        <template #default="{ row }">
          <el-tag :type="row.enabled === false ? 'info' : 'success'">
            {{ row.enabled === false ? '停用' : '启用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="visible" title="工种信息" width="480px">
      <el-form label-width="90px">
        <el-form-item label="业务标识">
          <el-input
            v-model="form.id"
            :disabled="editing"
            maxlength="40"
            placeholder="英文、数字或下划线"
          />
        </el-form-item>
        <el-form-item label="工种名称">
          <el-input v-model="form.name" maxlength="20" />
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api/guanhanquan'
const rows = ref([]),
  form = ref({}),
  loading = ref(false),
  saving = ref(false),
  visible = ref(false),
  editing = ref(false),
  error = ref('')
async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await api.categories()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
function open(row) {
  editing.value = !!row
  form.value = row
    ? { ...row, enabled: row.enabled !== false }
    : { id: '', name: '', sort: rows.value.length + 1, enabled: true }
  visible.value = true
}
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (!editing.value && rows.value.some((x) => x.id === form.value.id))
      throw new Error('业务标识已存在')
    await api.saveCategory(form.value)
    visible.value = false
    ElMessage.success('已保存')
    await load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
</style>
