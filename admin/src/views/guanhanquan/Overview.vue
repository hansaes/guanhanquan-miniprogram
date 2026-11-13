<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/guanhanquan'
import UsersIcon from '~icons/ri/group-line'
import JobsIcon from '~icons/ri/briefcase-line'
import ActiveIcon from '~icons/ri/pulse-line'
import ApplyIcon from '~icons/ri/user-follow-line'

const router = useRouter()
const data = ref(null), loading = ref(false), error = ref('')
const stats = computed(() => data.value ? [
  { title: '注册用户', value: data.value.users, detail: '今日新增 ' + data.value.today.newUsers, icon: UsersIcon, color: 'blue' },
  { title: '在招岗位', value: data.value.jobs.online, detail: '今日新增 ' + data.value.today.newJobs, icon: JobsIcon, color: 'green' },
  { title: '今日活跃', value: data.value.activeToday, detail: '近 30 天活跃 ' + data.value.mau, icon: ActiveIcon, color: 'orange' },
  { title: '报名总数', value: data.value.applications, detail: '本月新增用户 ' + data.value.monthUsers, icon: ApplyIcon, color: 'purple' }
] : [])
const pending = computed(() => data.value ? [
  { label: '招工审核', count: data.value.jobs.pending, path: '/jobs' },
  { label: '简历审核', count: data.value.resumePending, path: '/resumes' },
  { label: '实名与企业认证', count: data.value.realNamePending + data.value.enterprisePending, path: '/verifications' },
  { label: '黑名单审核', count: data.value.blacklistPending, path: '/blacklist' },
  { label: '举报处理', count: data.value.reportsPending, path: '/reports' },
  { label: '客服反馈', count: data.value.pendingFeedback, path: '/feedback' }
] : [])
const quickLinks = [
  { title: '工种管理', text: '名称、排序与启停', path: '/categories' },
  { title: '小程序内容', text: '页面内容与标签选项', path: '/content' },
  { title: '费用与奖励', text: '积分与有效期配置', path: '/settings' },
  { title: '操作日志', text: '查看管理操作记录', path: '/audit-logs' }
]
const trendMax = computed(() => Math.max(1, ...(data.value?.trend7d || []).flatMap(day => [day.users, day.jobs])))
async function load() {
  loading.value = true; error.value = ''
  try { data.value = await api.overview() } catch (cause) { error.value = cause.message } finally { loading.value = false }
}
onMounted(load)
</script>
<template>
  <div class="overview-page" v-loading="loading">
    <header class="overview-heading"><div><h2>运营概览</h2><p>平台数据与待处理事项</p></div><el-button :loading="loading" @click="load">刷新数据</el-button></header>
    <el-alert v-if="error" :title="error" show-icon type="error" :closable="false"><el-button link @click="load">重新加载</el-button></el-alert>
    <el-skeleton v-if="!data && loading" :rows="8" animated />
    <template v-if="data">
      <div class="metric-grid">
        <el-card v-for="item in stats" :key="item.title" shadow="never" class="metric-card">
          <div class="metric-head"><span>{{ item.title }}</span><span :class="['metric-icon', item.color]"><component :is="item.icon" /></span></div>
          <strong>{{ item.value.toLocaleString() }}</strong><p>{{ item.detail }}</p>
        </el-card>
      </div>
      <el-card shadow="never" class="queue-card">
        <template #header><div class="section-heading"><h3>待办事项</h3><span>点击进入处理</span></div></template>
        <div class="queue-grid"><button v-for="item in pending" :key="item.path" @click="router.push(item.path)"><span>{{ item.label }}</span><strong :class="{ pending: item.count > 0 }">{{ item.count }} <small>→</small></strong></button></div>
      </el-card>
      <div class="dashboard-columns">
        <el-card shadow="never" class="trend-card">
          <template #header><div class="section-heading"><h3>近 7 日新增</h3><div class="legend"><span class="users">用户</span><span class="jobs">岗位</span></div></div></template>
          <div class="trend-chart">
            <div v-for="day in data.trend7d" :key="day.day" class="trend-column">
              <div class="bar-group"><div class="bar users" :style="{ height: (day.users / trendMax * 120) + 'px' }" :title="'新增用户 ' + day.users"><span>{{ day.users }}</span></div><div class="bar jobs" :style="{ height: (day.jobs / trendMax * 120) + 'px' }" :title="'新增岗位 ' + day.jobs"><span>{{ day.jobs }}</span></div></div>
              <span class="day">{{ day.day.slice(-5) }}</span>
            </div>
          </div>
          <div class="trend-totals"><span>本周新增岗位 <b>{{ data.weekJobs }}</b></span><span>本月新增岗位 <b>{{ data.monthJobs }}</b></span><span>岗位总数 <b>{{ data.jobs.total }}</b></span></div>
        </el-card>
        <el-card shadow="never">
          <template #header><h3>常用入口</h3></template>
          <div class="quick-links"><button v-for="item in quickLinks" :key="item.path" @click="router.push(item.path)"><div><b>{{ item.title }}</b><p>{{ item.text }}</p></div><span>→</span></button></div>
        </el-card>
      </div>
      <div class="distribution-grid">
        <el-card v-for="group in [{ title: '工种分布', items: data.byCategory }, { title: '地区分布', items: data.byRegion }]" :key="group.title" shadow="never">
          <template #header><h3>{{ group.title }}</h3></template>
          <div v-for="item in group.items" :key="item.name" class="distribution-row"><span>{{ item.name }}</span><el-progress :percentage="Math.round(item.count / Math.max(1, ...group.items.map(x => x.count)) * 100)" :show-text="false" /><b>{{ item.count }}</b></div>
          <el-empty v-if="!group.items.length" description="暂无数据" :image-size="60" />
        </el-card>
      </div>
    </template>
  </div>
</template>
<style scoped>
.overview-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; gap: 16px; }
h2 { font-size: 22px; font-weight: 600; margin: 0 0 6px; }
h3 { font-size: 16px; font-weight: 600; margin: 0; }
p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
.el-card { border-radius: 10px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; margin-bottom: 20px; }
.metric-head { display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: var(--el-text-color-regular); }
.metric-icon { display: grid; place-items: center; height: 40px; width: 40px; border-radius: 12px; font-size: 21px; }
.blue { background: #edf4ff; color: #2563eb; }.green { background: #eafaef; color: #19a55a; }.orange { background: #fff3e7; color: #ed8a21; }.purple { background: #f4edff; color: #9062dc; }
.metric-card strong { display: block; font-size: 30px; font-weight: 600; margin: 8px 0 6px; line-height: 1.3; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.section-heading > span { font-size: 12px; color: var(--el-text-color-secondary); }
.queue-card { margin-bottom: 20px; }.queue-card :deep(.el-card__body) { padding: 0; }
.queue-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); }
.queue-grid button { padding: 22px 16px; text-align: left; border-right: 1px solid var(--el-border-color-extra-light); }.queue-grid button:last-child { border: 0; }
.queue-grid button, .quick-links button { cursor: pointer; background: transparent; color: var(--el-text-color-primary); border: 0; font: inherit; }
.queue-grid button:hover, .quick-links button:hover { background: var(--el-fill-color-light); }
.queue-grid button:focus-visible, .quick-links button:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.queue-grid span { display: block; color: var(--el-text-color-regular); font-size: 13px; }.queue-grid strong { display: flex; justify-content: space-between; font-size: 24px; font-weight: 600; margin-top: 10px; }.queue-grid small { font-size: 16px; color: var(--el-text-color-placeholder); }.pending { color: #e79b26; }
.dashboard-columns { display: grid; grid-template-columns: 1.8fr 1fr; gap: 20px; margin-bottom: 20px; }
.legend { display: flex; gap: 16px; font-size: 12px; }.legend span::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; background: #2563eb; }.legend .jobs::before { background: #79c5b1; }
.trend-chart { height: 190px; display: flex; justify-content: space-around; padding-top: 10px; }
.trend-column { flex: 1; display: flex; flex-direction: column; align-items: center; }.bar-group { height: 145px; display: flex; align-items: flex-end; gap: 8px; border-bottom: 1px solid var(--el-border-color-light); width: 100%; justify-content: center; }
.bar { position: relative; width: 16px; background: #2563eb; border-radius: 4px 4px 0 0; }.bar.jobs { background: #79c5b1; }.bar span { position: absolute; top: -20px; text-align: center; width: 100%; font-size: 10px; color: var(--el-text-color-secondary); }.day { margin-top: 10px; font-size: 12px; color: var(--el-text-color-secondary); }
.trend-totals { border-top: 1px solid var(--el-border-color-extra-light); display: flex; justify-content: space-between; flex-wrap: wrap; padding-top: 16px; gap: 10px; font-size: 12px; color: var(--el-text-color-secondary); }.trend-totals b { color: var(--el-text-color-primary); margin-left: 8px; }
.quick-links { display: grid; gap: 2px; }.quick-links button { display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 10px 8px; border-radius: 6px; }.quick-links b { font-size: 14px; font-weight: 500; }.quick-links span { color: var(--el-text-color-secondary); }
.distribution-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }.distribution-row { display: flex; gap: 16px; align-items: center; margin-bottom: 18px; font-size: 13px; }.distribution-row > span { width: 90px; }.distribution-row .el-progress { flex: 1; }.distribution-row b { width: 25px; text-align: right; }
@media (max-width: 1100px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.queue-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }.dashboard-columns { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .metric-grid { gap: 12px; }.metric-card :deep(.el-card__body) { padding: 14px; }.metric-icon { width: 30px; height: 30px; }.metric-card strong { font-size: 26px; }.queue-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.distribution-grid { grid-template-columns: 1fr; }.bar-group { gap: 4px; }.bar { width: 11px; } }
</style>
