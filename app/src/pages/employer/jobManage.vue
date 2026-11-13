<template>
  <view class="page">
    <cu-custom is-back><template #content>岗位管理</template></cu-custom>
    <auth-gate title="登录后管理岗位" target="/pages/employer/jobManage" @ready="load">
      <view class="tabs">
        <button
          role="button"
          v-for="tab in tabs"
          :key="tab.value"
          :aria-pressed="activeTab === tab.value"
          :class="['tab', { active: activeTab === tab.value }]"
          @tap="activeTab = tab.value"
        >
          <text>{{ tab.label }}</text>
          <text v-if="tab.count" class="count">{{ tab.count }}</text>
        </button>
      </view>

      <view class="list">
        <page-state v-if="loading || error" :loading="loading" :error="error" @retry="load" />
        <template v-else>
          <button v-if="walletError" role="button" class="cost-retry" @tap="load">
            费用加载失败，点击重试
          </button>
          <view class="item" v-for="job in filteredJobs" :key="job.id">
            <button role="button" class="head" @tap="viewJob(job)">
              <text class="title">{{ job.title }}</text>
              <text :class="['status', 's' + job.status]">{{ statusText(job.status) }}</text>
            </button>
            <view class="meta">
              <text>{{ salaryText(job) }}</text>
              <text>· {{ job.workArea }}</text>
              <text v-if="job.duration">· {{ job.duration }}</text>
            </view>
            <view class="stats">
              <text>{{ job.viewCount }} 浏览</text>
              <text>{{ job.applyCount }} 报名</text>
              <text>{{ fmt(job.createdAt) }}</text>
            </view>
            <view class="actions">
              <template v-if="job.status === 1">
                <button
                  role="button"
                  class="btn primary"
                  :disabled="wallet.topCost === null || actionBusy"
                  @tap="promote(job)"
                >
                  置顶 {{ wallet.topCost ?? '—' }} 分
                </button>
                <button
                  role="button"
                  class="btn"
                  :disabled="wallet.refreshCost === null || actionBusy"
                  @tap="refresh(job)"
                >
                  刷新 {{ wallet.refreshCost ?? '—' }} 分
                </button>
                <button role="button" class="btn" @tap="pause(job)">暂停</button>
                <button role="button" class="btn" @tap="applicants(job)">
                  报名 {{ job.applyCount }}
                </button>
              </template>
              <template v-else-if="job.status === 2">
                <button role="button" class="btn primary" @tap="resume(job)">恢复</button>
              </template>
              <button role="button" class="btn" @tap="edit(job)">编辑</button>
              <button role="button" class="btn danger" @tap="remove(job)">删除</button>
            </view>
            <view v-if="job.status === 4 && job.rejectReason" class="reason"
              >驳回原因：{{ job.rejectReason }}</view
            >
          </view>
          <view v-if="!filteredJobs.length" class="empty">
            <page-state :empty-text="activeTab === 'all' ? '还没有发布岗位' : '暂无此状态的岗位'" />
            <button role="button" class="ui-button" @tap="publish">发布招工</button>
          </view>
        </template>
      </view>
    </auth-gate>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { salaryText } from '@/utils/job'
import { session } from '@/utils/auth'

const STATUS_TEXT = { 0: '待审核', 1: '招聘中', 2: '已暂停', 3: '已过期', 4: '已驳回' }

export default {
  data() {
    return {
      jobs: [],
      session,
      loading: false,
      error: '',
      walletError: false,
      requestId: 0,
      actionBusy: false,
      activeTab: 'all',
      wallet: { topCost: null, refreshCost: null }
    }
  },
  computed: {
    tabs() {
      const count = (s) => this.jobs.filter((j) => j.status === s).length
      return [
        { label: '全部', value: 'all', count: this.jobs.length },
        { label: '待审核', value: 0, count: count(0) },
        { label: '招聘中', value: 1, count: count(1) },
        { label: '已暂停', value: 2, count: count(2) },
        { label: '已过期', value: 3, count: count(3) },
        { label: '已驳回', value: 4, count: count(4) }
      ]
    },
    filteredJobs() {
      if (this.activeTab === 'all') return this.jobs
      return this.jobs.filter((j) => j.status === this.activeTab)
    }
  },
  onShow() {
    if (session.authReady && session.userInfo?.id) this.load()
  },
  onUnload() {
    this.requestId++
  },
  methods: {
    salaryText,
    statusText(s) {
      return STATUS_TEXT[s] || '未知'
    },
    fmt(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return d.getMonth() + 1 + '-' + d.getDate()
    },
    async load() {
      const owner = session.userInfo?.id
      if (!owner) return
      const requestId = ++this.requestId
      this.loading = true
      this.error = ''
      this.walletError = false
      this.wallet = { topCost: null, refreshCost: null }
      try {
        const [res, wallet] = await Promise.allSettled([
          api.getEmployerJobs({ page: 1, pageSize: 50 }),
          api.getWallet()
        ])
        if (requestId !== this.requestId || owner !== session.userInfo?.id) return
        if (res.status === 'fulfilled') {
          this.jobs = res.value.data?.records || []
        } else {
          this.jobs = []
          this.error = '岗位加载失败，请重试'
        }
        const costs = wallet.status === 'fulfilled' ? wallet.value.data : null
        for (const key of ['topCost', 'refreshCost']) {
          const value = costs?.[key]
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
            this.wallet[key] = value
          } else {
            this.walletError = true
          }
        }
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    viewJob(job) {
      uni.navigateTo({ url: '/pages/jobDetail/jobDetail?id=' + job.id })
    },
    applicants(job) {
      uni.navigateTo({ url: '/pages/employer/applicants/list?jobId=' + job.id })
    },
    edit(job) {
      uni.navigateTo({ url: '/pages/employer/jobPost?id=' + job.id })
    },
    publish() {
      uni.navigateTo({ url: '/pages/employer/jobPost' })
    },
    async setStatus(job, status) {
      try {
        await api.setJobStatus(job.id, status)
        uni.showToast({ title: status === 2 ? '已暂停' : '已恢复', icon: 'success' })
        this.load()
      } catch (e) {}
    },
    pause(job) {
      uni.showModal({
        title: '暂停岗位',
        content: '暂停后工人暂时看不到这条岗位，可随时恢复。',
        success: (r) => {
          if (r.confirm) this.setStatus(job, 2)
        }
      })
    },
    resume(job) {
      uni.showModal({
        title: '恢复岗位',
        content: '恢复后岗位重新展示。',
        success: (r) => {
          if (r.confirm) this.setStatus(job, 1)
        }
      })
    },
    promote(job) {
      if (this.wallet.topCost === null) return
      this.confirmPaidAction(
        '置顶岗位',
        `将消耗 ${this.wallet.topCost} 积分，置顶 7 天，确认继续？`,
        () => api.topJob(job.id),
        '已置顶'
      )
    },
    refresh(job) {
      if (this.wallet.refreshCost === null) return
      this.confirmPaidAction(
        '刷新岗位',
        `将消耗 ${this.wallet.refreshCost} 积分，把岗位排到更前，确认继续？`,
        () => api.refreshJob(job.id),
        '已刷新'
      )
    },
    confirmPaidAction(title, content, action, successTitle) {
      const owner = session.userInfo?.id
      if (!owner || this.actionBusy) return
      this.actionBusy = true
      uni.showModal({
        title,
        content,
        success: async (r) => {
          try {
            if (!r.confirm || owner !== session.userInfo?.id) return
            await action()
            if (owner !== session.userInfo?.id) return
            uni.showToast({ title: successTitle, icon: 'success' })
            await this.load()
          } catch (e) {
            // 请求层统一展示业务错误。
          } finally {
            this.actionBusy = false
          }
        },
        fail: () => {
          this.actionBusy = false
        }
      })
    },
    remove(job) {
      uni.showModal({
        title: '删除岗位',
        content: '删除后工人不可见，历史报名保留。确认删除？',
        confirmColor: '#e54d42',
        success: async (r) => {
          if (!r.confirm) return
          try {
            await api.deleteJob(job.id)
            uni.showToast({ title: '已删除', icon: 'success' })
            this.load()
          } catch (e) {}
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--canvas);
  padding-bottom: 40rpx;
}
.tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  background: #fff;
  padding: 12px 32rpx;
}
.tab {
  width: 100%;
  min-height: 44px;
  line-height: 1.4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  margin: 0;
  border-radius: 12px;
  background: var(--canvas);
  font-size: var(--font-small);
  color: var(--text);
}
.tab.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
.cost-retry {
  background: transparent;
  color: var(--primary);
  min-height: 44px;
  font-size: var(--font-small);
  margin-bottom: 12px;
}
.count {
  margin-left: 6rpx;
}
.list {
  padding: 32rpx;
}
.item {
  background: #fff;
  border-radius: 24rpx;
  padding: 26rpx;
  margin-bottom: 20rpx;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  background: transparent;
  padding: 0;
  margin: 0;
  line-height: 1.5;
  text-align: left;
}
.title {
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
  color: var(--ink);
}
.status {
  font-size: var(--font-caption);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}
.s0 {
  background: #fff7e6;
  color: #fa8c16;
}
.s1 {
  background: #f6ffed;
  color: #52c41a;
}
.s2 {
  background: var(--canvas);
  color: var(--muted);
}
.s3 {
  background: #f0f0f0;
  color: var(--muted);
}
.s4 {
  background: #fff1f0;
  color: #e54d42;
}
.meta {
  margin-top: 12rpx;
  font-size: var(--font-small);
  color: var(--muted);
}
.meta text {
  margin-right: 10rpx;
}
.stats {
  margin-top: 10rpx;
  display: flex;
  gap: 24rpx;
  font-size: var(--font-caption);
  color: var(--muted);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
}
.btn {
  margin: 0 12rpx 12rpx 0;
  font-size: var(--font-caption);
  padding: 0 20rpx;
  height: 44px;
  line-height: 44px;
  border-radius: 30rpx;
  background: var(--canvas);
  color: var(--text);
}
.btn::after {
  border: none;
}
.btn.primary {
  background: var(--primary);
  color: #fff;
}
.btn.danger {
  background: #fff1f0;
  color: #e54d42;
}
.reason {
  margin-top: 8rpx;
  font-size: var(--font-caption);
  color: #e54d42;
}
.empty .ui-button {
  max-width: 260px;
  margin: 0 auto;
}
</style>
