<template>
  <uni-popup
    ref="popup"
    class="selection-popup"
    type="bottom"
    :safe-area="false"
    @change="$emit('change', $event)"
  >
    <view
      class="selection-panel"
      :class="{ compact }"
      role="dialog"
      :aria-label="title"
      aria-modal="true"
    >
      <view class="selection-heading">
        <text class="selection-title">{{ title }}</text>
        <button class="selection-close" role="button" aria-label="关闭选择" @tap="close">
          <uni-icons type="closeempty" size="24" color="#798496" />
        </button>
      </view>
      <view class="selection-content"><slot /></view>
    </view>
  </uni-popup>
</template>
<script>
export default {
  props: { title: { type: String, default: '请选择' }, compact: Boolean },
  emits: ['change'],
  methods: {
    open() {
      this.$refs.popup.open()
    },
    close() {
      this.$refs.popup.close()
    }
  }
}
</script>
<style>
.selection-popup {
  z-index: 1100 !important;
}
.selection-panel {
  width: 100%;
  max-width: 560px;
  height: 68vh;
  max-height: 620px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  overflow: hidden;
  color: #182131;
}
.selection-heading {
  height: 64px;
  flex-shrink: 0;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.selection-panel.compact {
  height: auto;
}
.selection-title {
  font-size: 18px;
  font-weight: 600;
}
.selection-close {
  width: 44px;
  height: 44px;
  line-height: 44px;
  padding: 0;
  margin: 0 -10px 0 0;
  background: transparent;
}
.selection-close::after {
  border: 0;
}
.selection-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
@media (orientation: landscape) and (max-height: 500px) {
  .selection-panel {
    height: 88vh;
  }
  .selection-heading {
    height: 48px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .selection-popup .uni-transition {
    transition-duration: 0ms !important;
  }
}
</style>
