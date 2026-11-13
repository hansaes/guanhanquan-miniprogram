<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>报名管理</template></cu-custom>

    <view class="card" v-for="j in jobs" :key="j.id">
      <view class="head" @tap="toggle(j)">
        <view>
          <text class="title">{{ j.title }}</text>
          <text class="meta">{{ j.workArea }} · {{ salaryText(j) }}</text>
        </view>
        <text class="count">{{ j.applyCount }} 人报名</text>
      </view>

      <view v-if="expanded === j.id" class="apps">
        <view v-if="!applicants.length" class="empty">还没有人报名</view>
        <view class="app" v-for="a in applicants" :key="a.id">
          <view class="app-info">
            <text class="name">{{ a.workerName || '工友' }}</text>
            <text class="phone">{{ a.workerPhone }}</text>
            <text class="note" v-if="a.coverLetter">{{ a.coverLetter }}</text>
          </view>
          <view class="app-ops" v-if="a.status === 'pending'">
            <button role="button" class="ok" @tap="decide(j, a, true)">录用</button>
            <button role="button" class="no" @tap="decide(j, a, false)">拒绝</button>
          </view>
          <text class="done" v-else>{{ a.status === 'accepted' ? '已录用' : '已拒绝' }}</text>
        </view>
      </view>
    </view>

    <view v-if="!loading && !jobs.length" class="empty-page">还没有发布过岗位</view>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { salaryText } from '@/utils/job'
export default {
  data() {
    return { jobs: [], applicants: [], expanded: '', loading: false }
  },
  onLoad() { this.load() },
  methods: {
    salaryText,
    async load() {
      this.loading = true
      try {
        const res = await api.getEmployerJobs({ page: 1, pageSize: 50, status: 1 })
        this.jobs = (res.data && res.data.records) || []
      } catch (e) { this.jobs = [] } finally { this.loading = false }
    },
    async toggle(j) {
      if (this.expanded === j.id) { this.expanded = ''; return }
      this.expanded = j.id
      try {
        const res = await api.getApplicantsForJob(j.id)
        this.applicants = (res.data && res.data.records) || []
      } catch (e) { this.applicants = [] }
    },
    async decide(j, a, pass) {
      try {
        if (pass) await api.acceptJobApplicant(j.id, a.id)
        else await api.rejectJobApplicant(j.id, a.id)
        a.status = pass ? 'accepted' : 'rejected'
        uni.showToast({ title: pass ? '已录用' : '已拒绝', icon: 'success' })
      } catch (e) {}
    }
  }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--canvas); }
.card { background: #fff; margin: 24rpx 32rpx; border-radius: 24rpx; padding: 28rpx; }
.head { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 16px; font-weight: 600; display: block; }
.meta { font-size: var(--font-caption); color: var(--muted); }
.count { font-size: var(--font-caption); color: var(--primary); }
.apps { margin-top: 20rpx; border-top: 1rpx solid #f0f0f0; padding-top: 16rpx; }
.app { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; }
.name { font-size: var(--font-body); margin-right: 16rpx; }
.phone { font-size: var(--font-small); color: var(--primary); }
.note { display: block; font-size: var(--font-caption); color: var(--muted); margin-top: 6rpx; }
.ok { background: #52c41a; color: #fff; font-size: var(--font-caption); border-radius: 30rpx; padding: 0 20rpx; height: 56rpx; line-height: 56rpx; display: inline-block; margin-right: 12rpx; }
.no { background: var(--canvas); color: var(--muted); font-size: var(--font-caption); border-radius: 30rpx; padding: 0 20rpx; height: 56rpx; line-height: 56rpx; display: inline-block; }
.done { font-size: var(--font-caption); color: var(--muted); }
.empty { font-size: var(--font-caption); color: var(--muted); text-align: center; padding: 20rpx 0; }
.empty-page { text-align: center; color: var(--muted); padding: 140rpx 0; font-size: var(--font-small); }
</style>