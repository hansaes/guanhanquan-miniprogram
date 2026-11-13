<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>我的收藏</template></cu-custom>

    <view class="card" v-for="j in list" :key="j.id" @tap="goDetail(j)">
      <view class="row">
        <text class="title">{{ j.title }}</text>
        <text class="salary">{{ salaryText(j) }}</text>
      </view>
      <view class="meta">{{ j.workArea }} · {{ j.duration }}</view>
      <view class="ops">
        <text class="link" @tap.stop="remove(j)">取消收藏</text>
      </view>
    </view>

    <view v-if="!loading && !list.length" class="empty">还没有收藏的岗位</view>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { salaryText } from '@/utils/job'
export default {
  data() { return { list: [], loading: false } },
  onLoad() { this.load() },
  methods: {
    salaryText,
    async load() {
      this.loading = true
      try {
        const res = await api.getFavorites({ page: 1, pageSize: 50 })
        this.list = (res.data && res.data.records) || []
      } catch (e) { this.list = [] } finally { this.loading = false }
    },
    goDetail(j) { uni.navigateTo({ url: '/pages/jobDetail/jobDetail?id=' + j.id }) },
    async remove(j) {
      try {
        await api.toggleFavorite(j.id)
        this.list = this.list.filter((x) => x.id !== j.id)
      } catch (e) {}
    }
  }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--canvas); padding-bottom: 40rpx; }
.card { background: #fff; margin: 24rpx 32rpx; border-radius: 24rpx; padding: 28rpx; }
.row { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 16px; font-weight: 600; }
.salary { color: var(--salary); font-size: var(--font-control); font-weight: 700; }
.unit { font-size: var(--font-caption); font-weight: 400; }
.meta { margin-top: 10rpx; font-size: var(--font-caption); color: var(--muted); }
.ops { margin-top: 16rpx; text-align: right; }
.link { color: var(--primary); font-size: var(--font-small); }
.empty { text-align: center; color: var(--muted); padding: 140rpx 0; font-size: var(--font-small); }
</style>