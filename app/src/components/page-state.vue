<template>
  <view v-if="loading" class="state skeletons" aria-label="加载中" aria-busy="true">
    <view v-for="i in 3" :key="i" class="skeleton-card">
      <view class="skeleton-line" />
      <view class="skeleton-line short" />
      <view class="skeleton-line medium" />
    </view>
  </view>
  <view v-else class="state ui-enter" :role="error ? 'alert' : 'status'" aria-live="polite">
    <view class="state-symbol">
      <uni-icons :type="error ? 'cloud-download' : 'search'" size="44" color="#a1adc1" />
    </view>
    <text class="state-title">{{ error || emptyText }}</text>
    <button
      v-if="error"
      role="button"
      class="ui-button ui-button-ghost retry"
      @tap="$emit('retry')"
    >
      重新加载
    </button>
  </view>
</template>
<script>
export default {
  props: { loading: Boolean, error: String, emptyText: { type: String, default: '暂无相关内容' } },
  emits: ['retry']
}
</script>
<style scoped>
.state {
  padding: 88rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}
.state-title {
  color: var(--muted);
  font-size: var(--font-body);
  line-height: 1.65;
  text-align: center;
  max-width: 260px;
}
.state-symbol {
  width: 76px;
  height: 76px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #edf1f6;
}
.retry {
  min-width: 220rpx;
}
.skeletons {
  padding: 0;
  gap: 24rpx;
}
.skeleton-card {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 36rpx;
  box-sizing: border-box;
}
.skeleton-line {
  height: 32rpx;
  background: #edf1f7;
  margin-bottom: 26rpx;
  border-radius: 8rpx;
  animation: breathe 1.4s ease-in-out infinite;
}
.short {
  width: 48%;
}
.medium {
  width: 72%;
  margin-bottom: 0;
}
@keyframes breathe {
  50% {
    opacity: 0.4;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
  }
}
</style>
