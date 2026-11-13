<template>
  <view class="ui-page login-page">
    <cu-custom isBack
      ><template #content>{{ profileStep ? '完善资料' : '登录' }}</template></cu-custom
    >
    <view class="login-body ui-enter">
      <view v-if="!profileStep" class="brand-mark"
        ><uni-icons type="staff-filled" size="42" color="#2563eb"
      /></view>
      <text class="login-title">{{
        profileStep ? '完善个人资料' : content.brandName || '管焊圈'
      }}</text>
      <profile-form
        v-if="profileStep"
        :user="user"
        optional
        submit-text="保存并继续"
        @saved="finish"
        @skip="finish"
      />
      <view v-else>
        <text class="login-note">登录后查看岗位、发布招工</text>
        <text v-if="error" class="login-error" role="alert">{{ error }}</text>
        <button
          class="ui-button login-button"
          role="button"
          :loading="loading"
          :disabled="loading"
          @tap="wechatLogin"
        >
          <uni-icons type="weixin" size="22" color="#fff" />
          {{ developmentLogin ? '本地开发登录' : '微信一键登录' }}
        </button>
        <view v-if="!developmentLogin" class="agreement">
          <checkbox-group @change="agreed = $event.detail.value.includes('agree')">
            <label class="agree-check"
              ><checkbox
                value="agree"
                :checked="agreed"
                color="#2563eb"
                aria-label="同意用户协议和隐私政策"
              />我已阅读并同意</label
            >
          </checkbox-group>
          <button role="button" class="doc-link" @tap="showDoc('user')">用户协议</button>
          <text>与</text>
          <button role="button" class="doc-link" @tap="showDoc('privacy')">隐私政策</button>
        </view>
        <button role="button" class="browse" :disabled="loading" @tap="browse">返回首页</button>
      </view>
    </view>
  </view>
</template>
<script>
import api from '@/api'
import { HTTP_API_BASE, HTTP_DEV_LOGIN_KEY } from '@/config'
import { content, loadContent } from '@/utils/content'
import { setUser, getUser, safeReturnUrl, finishLogin } from '@/utils/auth'
import ProfileForm from '@/components/profile-form.vue'
export default {
  components: { ProfileForm },
  data() {
    let developmentLogin = false
    // #ifdef H5
    developmentLogin = import.meta.env.DEV && !!HTTP_API_BASE && !!HTTP_DEV_LOGIN_KEY
    // #endif
    return {
      content,
      developmentLogin,
      loading: false,
      agreed: false,
      error: '',
      profileStep: false,
      user: {},
      redirect: '/pages/index/index'
    }
  },
  onLoad(options) {
    this.redirect = safeReturnUrl(options.redirect)
    loadContent().catch(() => {})
  },
  methods: {
    async wechatLogin() {
      if (this.loading) return
      if (!this.developmentLogin && !this.agreed) {
        this.error = '请先阅读并同意用户协议和隐私政策'
        return
      }
      this.loading = true
      this.error = ''
      try {
        const result = await api.login()
        if (!result.data?.user?.id) throw new Error('登录失败，请重试')
        this.user = result.data.user
        setUser(this.user)
        this.$store.commit('setAuthReady', true)
        if (!this.user.nickname || !this.user.avatar) this.profileStep = true
        else this.finish()
      } catch (error) {
        this.error = /cancel/i.test(error.errMsg || '')
          ? '已取消登录，可重新尝试'
          : error.message || '登录失败，请重试'
      } finally {
        this.loading = false
      }
    },
    finish() {
      this.user = getUser() || this.user
      finishLogin(this.redirect)
    },
    browse() {
      uni.switchTab({ url: '/pages/index/index' })
    },
    showDoc(name) {
      uni.navigateTo({
        url: name === 'user' ? '/pages/common/user-agreement' : '/pages/common/privacy-policy'
      })
    }
  }
}
</script>
<style scoped>
.login-body {
  max-width: 420px;
  margin: 32rpx auto;
  width: calc(100% - 64rpx);
  padding: 40px 24px 24px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 32rpx;
  box-shadow: var(--shadow-card);
}
.brand-mark {
  width: 132rpx;
  height: 132rpx;
  border-radius: 36rpx;
  margin: 0 auto 32rpx;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-title {
  display: block;
  text-align: center;
  font-size: var(--font-display);
  font-weight: 650;
  color: var(--ink);
  margin-bottom: 24rpx;
}
.login-note {
  display: block;
  text-align: center;
  color: var(--muted);
  font-size: var(--font-body);
  margin-bottom: 72rpx;
}
.login-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  width: 100%;
}
.login-error {
  display: block;
  margin-bottom: 24rpx;
  color: var(--danger);
  font-size: var(--font-small);
  text-align: center;
}
.agreement {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0 6rpx;
  color: var(--muted);
  font-size: var(--font-caption);
  margin-top: 28rpx;
}
.agree-check {
  min-height: 44px;
  display: flex;
  align-items: center;
}
.agree-check checkbox {
  transform: scale(0.8);
}
.doc-link {
  background: transparent;
  color: var(--primary);
  font-size: inherit;
  padding: 0 4rpx;
  margin: 0;
  min-height: 44px;
  line-height: 44px;
}
.browse {
  margin-top: 24rpx;
  background: transparent;
  color: var(--muted);
  font-size: var(--font-body);
  min-height: 44px;
}
.doc-link::after,
.browse::after {
  border: 0;
}
</style>
