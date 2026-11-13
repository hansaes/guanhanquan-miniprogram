<template>
  <page-state v-if="!session.authReady" loading />
  <slot v-else-if="authenticated" />
  <view v-else class="auth-gate ui-enter">
    <view class="auth-symbol"><uni-icons type="locked-filled" size="32" color="#2563eb" /></view>
    <text class="auth-title">{{ title }}</text>
    <button class="ui-button" role="button" @tap="login">登录 / 注册</button>
  </view>
</template>
<script>
import { session, goLogin } from '@/utils/auth'
export default {
  props: { title: { type: String, default: '登录后继续' }, target: String },
  emits: ['ready'],
  data: () => ({ session }),
  computed: {
    authenticated() {
      return !!this.session.userInfo?.id && this.session.authReady
    }
  },
  watch: {
    authenticated: {
      immediate: true,
      handler(value) {
        if (value) this.$emit('ready')
      }
    }
  },
  methods: {
    login() {
      goLogin(this.target)
    }
  }
}
</script>
<style scoped>
.auth-gate {
  padding: 40px 24px;
  margin: 32rpx;
  border: 1px solid var(--line);
  border-radius: 32rpx;
  background: #fff;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.auth-symbol {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}
.auth-title {
  font-size: var(--font-title);
  font-weight: 600;
  margin: 24px 0 28px;
  text-align: center;
  line-height: 1.5;
  color: var(--ink);
}
.auth-gate .ui-button {
  width: 100%;
  max-width: 300px;
}
@media (min-width: 560px) {
  .auth-gate {
    max-width: 480px;
    margin: 32px auto;
  }
}
</style>
