<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>客服中心</template></cu-custom>

    <page-state v-if="loading || error" :loading="loading" :error="error" @retry="load" />
    <view class="card" v-else>
      <view class="section-title">常见问题</view>
      <uni-collapse v-model="activeFaq" accordion>
        <uni-collapse-item
          v-for="(f, i) in faqs"
          :key="i"
          :name="String(i)"
          :open="activeFaq === String(i)"
          :title="f.q"
          :border="i < faqs.length - 1"
          :show-arrow="false"
        >
          <template #title>
            <button
              role="button"
              tabindex="0"
              class="faq-toggle"
              :aria-expanded="activeFaq === String(i)"
              :aria-controls="'faq-answer-' + i"
              @tap.stop="toggleFaq(i)"
              @keydown.enter.prevent="toggleFaq(i)"
              @keydown.space.prevent="toggleFaq(i)"
            >
              <text>{{ f.q }}</text>
              <view
                class="faq-arrow"
                :class="{ expanded: activeFaq === String(i) }"
                aria-hidden="true"
                ><uni-icons type="bottom" size="16" color="#657287"
              /></view>
            </button>
          </template>
          <view class="answer" :id="'faq-answer-' + i" :aria-hidden="activeFaq !== String(i)">{{
            f.a
          }}</view>
        </uni-collapse-item>
      </uni-collapse>
    </view>

    <view class="card">
      <view class="section-title">联系我们</view>
      <button role="button" class="item item-btn" open-type="contact">
        <text>在线客服</text><text class="link">微信会话</text>
      </button>
      <button role="button" class="item item-btn" @tap="feedback">
        <text>意见反馈</text><text class="arrow">›</text>
      </button>
    </view>
  </view>
</template>

<script>
import { content, loadContent } from '@/utils/content'
export default {
  data() {
    return {
      activeFaq: '',
      content,
      error: '',
      loading: true
    }
  },
  computed: {
    faqs() {
      return this.content.faqs
    }
  },
  onLoad() {
    this.load()
  },
  methods: {
    toggleFaq(index) {
      const name = String(index)
      this.activeFaq = this.activeFaq === name ? '' : name
    },
    async load() {
      this.loading = true
      this.error = ''
      try {
        await loadContent()
      } catch (e) {
        this.error = '内容加载失败'
      } finally {
        this.loading = false
      }
    },
    feedback() {
      uni.navigateTo({ url: '/pages/mine/feedback' })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--canvas);
}
.card {
  background: #fff;
  margin: 24rpx 32rpx;
  border-radius: 24rpx;
  padding: 28rpx;
}
.section-title {
  font-size: var(--font-control);
  font-weight: 600;
  margin-bottom: 12rpx;
}
.card :deep(.uni-collapse-item__title-box) {
  padding: 0;
  min-height: 48px;
}
.card :deep(.uni-collapse-item__title-text) {
  font-size: var(--font-body);
  color: var(--text);
}
.card :deep(.uni-collapse-item__wrap-content) {
  border-color: var(--line);
}
.answer {
  padding: 0 0 16px;
  font-size: var(--font-body);
  color: var(--muted);
  line-height: 1.75;
}
.faq-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 52px;
  padding: 12px 0;
  margin: 0;
  border-radius: 0;
  background: transparent;
  text-align: left;
  font-size: var(--font-body);
  line-height: 1.6;
  color: var(--text);
}
.faq-arrow {
  flex-shrink: 0;
  display: flex;
  transition: transform 220ms var(--ease-out);
}
.faq-arrow.expanded {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .faq-arrow,
  .card :deep(.is--transition) {
    transition: none;
  }
}
.arrow {
  color: var(--muted);
}
.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-top: 1rpx solid var(--canvas);
  font-size: var(--font-body);
}
.item:first-of-type {
  border-top: none;
}
.link {
  color: var(--primary);
}
.item-btn {
  margin: 0;
  min-height: 48px;
  background: #fff;
  border-radius: 0;
  text-align: left;
  line-height: normal;
  font-size: var(--font-body);
}
.item-btn::after {
  border: none;
}
</style>
