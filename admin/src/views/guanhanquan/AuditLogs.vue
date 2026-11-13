<template>
  <div class="page-card">
    <div class="heading"><h3 class="page-title">操作日志</h3><el-button :loading="loading" @click="load(1)">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button link @click="load()">重试</el-button></el-alert>
    <el-table :data="rows" v-loading="loading" :empty-text="error ? '加载失败' : '暂无操作日志'">
      <el-table-column prop="username" label="管理员" min-width="120" />
      <el-table-column label="操作内容" min-width="240"><template #default="{ row }">{{ describe(row) }}</template></el-table-column>
      <el-table-column prop="targetId" label="记录标识" min-width="160" show-overflow-tooltip />
      <el-table-column label="操作时间" min-width="180"><template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '—' }}</template></el-table-column>
    </el-table>
    <el-pagination :current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" class="pagination" @current-change="load" />
  </div>
</template>
<script setup>
import { onMounted } from 'vue'
import api from '@/api/guanhanquan'
import { usePagedList } from '@/composables/usePagedList'
const { rows, total, page, pageSize, loading, error, load } = usePagedList((paging) => api.auditLogs(paging))
function describe(row) {
  const resource = String(row.path || '').split('/')[2]
  const name = { jobs: '招工信息', users: '用户', verifications: '认证资料', resumes: '简历', blacklist: '黑老板标记', appeals: '申诉', reports: '举报', announcements: '公告', banners: '轮播图', content: '页面内容', categories: '工种', trainings: '培训课程', insurances: '保险产品', settings: '费用与奖励', feedback: '客服反馈' }[resource] || '记录'
  if (row.path?.endsWith('/review')) return '审核' + name
  if (row.path?.endsWith('/handle')) return '处理' + name
  if (row.path?.endsWith('/status')) return '更新' + name + '状态'
  if (row.method === 'DELETE') return (['trainings', 'insurances'].includes(resource) ? '下架' : '删除') + name
  if (row.method === 'PUT' || ['content', 'categories', 'banners', 'announcements', 'settings'].includes(resource)) return '保存' + name
  return '新增' + name
}
onMounted(() => load())
</script>
<style scoped>
.heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; }
.heading .page-title { margin: 0; }
.pagination { margin-top: 20px; max-width: 100%; overflow: auto; }
.el-alert { margin-bottom: 16px; }
</style>
