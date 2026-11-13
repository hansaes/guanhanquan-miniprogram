<template>
  <view class="app-tabbar" role="navigation" aria-label="主导航">
    <button
      v-for="(tab, i) in tabs"
      :key="tab.path"
      class="app-tab"
      role="button"
      tabindex="0"
      hover-class="tab-pressed"
      :hover-start-time="0"
      :hover-stay-time="120"
      :class="{ selected: current === i }"
      :aria-label="labels[i]"
      :aria-current="current === i ? 'page' : undefined"
      @tap="go(tab.path, i)"
      @keydown.enter.prevent="go(tab.path, i)"
      @keydown.space.prevent="go(tab.path, i)"
    >
      <view class="tab-symbol">
        <view class="tab-icon" aria-hidden="true">
          <uni-icons
            :type="current === i ? tab.activeIcon : tab.icon"
            :size="25"
            :color="current === i ? '#2563eb' : '#657287'"
          />
        </view>
      </view>
      <text>{{ labels[i] }}</text>
    </button>
  </view>
</template>
<script>
import { content } from '@/utils/content'
export default {
  props: { current: { type: Number, default: 0 } },
  data: () => ({
    content,
    switching: false,
    tabs: [
      { path: '/pages/index/index', icon: 'home', activeIcon: 'home-filled' },
      { path: '/pages/publish/index', icon: 'plus', activeIcon: 'plus-filled' },
      { path: '/pages/mine/mine', icon: 'person', activeIcon: 'person-filled' }
    ]
  }),
  computed: {
    labels() {
      const labels = this.content.tabs
      // 兼容已发布接口中的四项导航配置，保留个人中心的自定义名称。
      if (labels.length === 4) return [labels[0], labels[1], labels[3]]
      return labels.length === 3 ? labels : ['首页', '发布招工', '我的']
    }
  },
  mounted() {
    uni.hideTabBar({ animation: false })
  },
  methods: {
    go(url, index) {
      if (index === this.current || this.switching) return
      this.switching = true
      uni.switchTab({
        url,
        fail: () => uni.showToast({ title: '暂时无法打开，请重试', icon: 'none' }),
        complete: () => {
          this.switching = false
        }
      })
    }
  }
}
</script>
<style scoped>
.app-tabbar {
  position: fixed;
  z-index: 90;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 6px 12px calc(6px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid var(--line);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -4px 24px rgba(24, 45, 82, 0.045);
}
.app-tab {
  flex: 1;
  background: transparent;
  padding: 2px 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 56px;
  color: var(--muted);
  font-size: var(--font-caption);
  line-height: 18px;
  border-radius: 16px;
}
.app-tab.selected {
  color: #2563eb;
  font-weight: 600;
}
.tab-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 32px;
  margin-bottom: 2px;
  border-radius: 18px;
  transition:
    background-color 180ms ease,
    transform 160ms var(--ease-out);
}
.selected .tab-symbol {
  background: var(--primary-soft);
}
.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
.selected .tab-icon {
  animation: tab-select 260ms var(--ease-out);
}
.tab-pressed .tab-symbol {
  transform: scale(0.88);
  background: #e4edff;
}
@keyframes tab-select {
  from {
    transform: translateY(3px) scale(0.86);
  }
  to {
    transform: translateY(0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .tab-symbol {
    transition: none;
  }
  .selected .tab-icon {
    animation: none;
  }
  .tab-pressed .tab-symbol {
    transform: none;
  }
}
.app-tab::after {
  border: 0;
}
</style>
