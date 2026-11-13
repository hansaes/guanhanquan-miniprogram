<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>工人简历库</template></cu-custom>
    <auth-gate title="登录后查看工人简历" target="/pages/employer/resume/index" @ready="reload">
      <view class="search-box">
        <input
          aria-label="搜索关键词"
          v-model="keyword"
          placeholder="姓名、技能、地区"
          confirm-type="search"
          @confirm="reload"
        />
        <button role="button" class="ui-text-button" @tap="reload">搜索</button>
      </view>

      <view class="list">
        <page-state
          v-if="!list.length"
          :loading="loading"
          :error="error"
          empty-text="暂无匹配简历"
          @retry="reload"
        />
        <button
          role="button"
          class="item"
          v-for="w in list"
          :key="w.id"
          :aria-label="'查看' + w.name + '的简历'"
          @tap="open(w)"
        >
          <view class="ui-avatar avatar">
            <image
              v-if="w.avatar && !failedAvatars[w.id]"
              :src="w.avatar"
              mode="aspectFill"
              @error="failedAvatars[w.id] = true"
            />
            <uni-icons v-else type="person-filled" size="25" color="#a1adc1" />
          </view>
          <view class="body">
            <view class="head">
              <text class="name">{{ w.name }}</text>
              <text v-if="w.certificateInfo" class="tag cert">{{ w.certificateInfo }}</text>
            </view>
            <view class="tags">
              <text class="tag" v-for="(t, i) in w.jobTypes" :key="i">{{ t }}</text>
            </view>
            <view class="meta"
              >{{ w.workExperience }} · 期望 {{ w.expectArea || '不限' }} ·
              {{ w.expectSalary || '面议' }}</view
            >
            <view class="foot">更新于 {{ ago(w.updatedAt) }}</view>
          </view>
        </button>
        <button
          v-if="list.length && error"
          role="button"
          class="ui-text-button retry-more"
          @tap="loadMore"
        >
          加载失败，点击重试
        </button>
        <view v-else-if="list.length" class="ui-end">{{
          loading ? '正在加载…' : hasMore ? '上拉加载更多' : '已经到底了'
        }}</view>
      </view>
    </auth-gate>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { session } from '@/utils/auth'
export default {
  data() {
    return {
      keyword: '',
      query: '',
      list: [],
      page: 0,
      pageSize: 20,
      total: 0,
      loading: false,
      hasMore: true,
      error: '',
      requestId: 0,
      failedAvatars: {}
    }
  },
  onReachBottom() {
    this.loadMore()
  },
  onUnload() {
    this.requestId++
  },
  methods: {
    ago(ts) {
      if (!ts) return '-'
      const time = new Date(ts).getTime()
      if (!Number.isFinite(time)) return '-'
      const d = Math.max(0, Date.now() - time)
      const h = 3600 * 1000
      if (d < h) return '刚刚'
      if (d < 24 * h) return Math.floor(d / h) + ' 小时前'
      return Math.floor(d / (24 * h)) + ' 天前'
    },
    async reload() {
      this.query = this.keyword.trim()
      this.page = 0
      this.hasMore = true
      this.list = []
      this.failedAvatars = {}
      await this.fetch(true)
    },
    async loadMore() {
      if (!this.hasMore || this.loading) return
      await this.fetch(false)
    },
    async fetch(reset) {
      const owner = session.userInfo?.id
      if (!owner || (!reset && this.loading)) return
      const requestId = ++this.requestId
      const page = reset ? 1 : this.page + 1
      this.loading = true
      this.error = ''
      try {
        const res = await api.getWorkerList({
          page,
          pageSize: this.pageSize,
          keyword: this.query || undefined
        })
        if (requestId !== this.requestId || owner !== session.userInfo?.id) return
        const d = res.data || {}
        const records = d.records || []
        this.total = d.total || 0
        this.list = reset ? records : this.list.concat(records)
        this.page = page
        this.hasMore = this.list.length < this.total
      } catch (e) {
        if (requestId === this.requestId && owner === session.userInfo?.id)
          this.error = '简历加载失败，请重试'
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    open(w) {
      uni.navigateTo({ url: '/pages/employer/resume/detail?id=' + w.id })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--canvas);
}
.search-box {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  padding: 16rpx 32rpx;
}
.search-box input {
  flex: 1;
  min-width: 0;
  background: var(--canvas);
  border-radius: 40rpx;
  height: 44px;
  padding: 0 24rpx;
  font-size: var(--font-body);
}
.list {
  padding: 32rpx;
}
.item {
  display: flex;
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin: 0 0 24rpx;
  line-height: 1.6;
  text-align: left;
}
.avatar {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  margin-right: 20rpx;
}
.body {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.name {
  font-size: 16px;
  font-weight: 600;
  margin-right: 12rpx;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8rpx;
}
.tag {
  font-size: var(--font-caption);
  background: #eaf3ff;
  color: var(--primary);
  border-radius: 6rpx;
  padding: 2rpx 12rpx;
  margin-right: 10rpx;
}
.tag.cert {
  background: #f6ffed;
  color: #52c41a;
}
.meta {
  margin-top: 10rpx;
  font-size: var(--font-caption);
  color: var(--muted);
}
.foot {
  margin-top: 6rpx;
  font-size: var(--font-caption);
  color: var(--muted);
}
.retry-more {
  width: 100%;
}
</style>
