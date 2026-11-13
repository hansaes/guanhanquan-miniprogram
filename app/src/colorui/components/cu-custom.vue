<template>
  <view>
    <view class="cu-custom" :style="[{ height: CustomBar + 'px' }]">
      <view
        class="cu-bar fixed"
        :style="style"
        :class="[bgImage != '' ? 'none-bg text-white bg-img' : '', bgColor]"
      >
        <button class="action" role="button" aria-label="返回" @tap="BackPage" v-if="isBack">
          <text class="cuIcon-back"></text>
          <slot name="backText"></slot>
        </button>
        <view class="content" :style="[{ top: StatusBar + 'px' }]">
          <slot name="content"></slot>
        </view>
        <slot name="right"></slot>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    let statusBar = 0
    let customBar = 44
    try {
      const sys = uni.getSystemInfoSync() || {}
      statusBar = sys.statusBarHeight || 0
      // #ifdef MP-WEIXIN
      if (uni.getMenuButtonBoundingClientRect) {
        const menu = uni.getMenuButtonBoundingClientRect()
        if (menu && menu.bottom) customBar = menu.bottom + menu.top - statusBar
      }
      // #endif
      if (!customBar || customBar <= statusBar) customBar = statusBar + 44
    } catch (e) {}
    return { StatusBar: statusBar, CustomBar: customBar }
  },
  name: 'cu-custom',
  computed: {
    style() {
      // 状态栏高度兜底：环境返回 0 时按 20px 处理，避免标题贴顶
      var StatusBar = Math.max(0, Number(this.StatusBar) || 0)
      var CustomBar = Math.max(StatusBar + 44, Number(this.CustomBar) || 0)
      var bgImage = this.bgImage
      var style = `height:${CustomBar}px;padding-top:${StatusBar}px;`
      if (this.bgImage) {
        style = `${style}background-image:url(${bgImage});`
      }
      return style
    }
  },
  props: {
    bgColor: {
      type: String,
      default: ''
    },
    isBack: {
      type: [Boolean, String],
      default: false
    },
    bgImage: {
      type: String,
      default: ''
    }
  },
  methods: {
    BackPage() {
      if (getCurrentPages().length > 1) uni.navigateBack({ delta: 1 })
      else uni.switchTab({ url: '/pages/index/index' })
    }
  }
}
</script>

<style>
.cu-custom .cu-bar {
  background: #fff !important;
  color: #182131 !important;
  box-shadow: none;
  border-bottom: 1rpx solid #f1f3f6;
}
.cu-custom .cu-bar .content {
  font-size: var(--font-heading);
  font-weight: 650;
}
.cu-custom .cu-bar .action {
  margin: 0 0 0 12px;
  padding: 0;
  width: 44px;
  height: 44px;
  min-height: 44px;
  line-height: 44px;
  justify-content: center;
  border-radius: 50%;
  color: #263247;
  background: transparent;
}
</style>
