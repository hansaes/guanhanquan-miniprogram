<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>实名认证</template></cu-custom>

    <page-state
      v-if="loading || loadError"
      :loading="loading"
      :error="loadError"
      @retry="loadProfile"
    />
    <view class="card" v-else-if="status === 1">
      <view class="done">已通过实名认证</view>
      <view class="sub">姓名：{{ maskedName }}</view>
    </view>

    <view v-else>
      <view class="card">
        <view class="tip">实名信息仅用于核验身份，平台加密存储，不对外展示。</view>
        <view class="row">
          <text class="label">真实姓名</text>
          <input
            aria-label="真实姓名"
            class="input"
            v-model="form.realName"
            placeholder="与身份证一致"
            maxlength="20"
          />
        </view>
        <view class="row">
          <text class="label">身份证号</text>
          <input
            aria-label="身份证号"
            class="input"
            v-model="form.idCard"
            placeholder="18 位身份证号"
            maxlength="18"
          />
        </view>
      </view>
      <button role="button"
        class="submit"
        :loading="submitting"
        :disabled="submitting || status === 0"
        @tap="submit"
      >
        {{ status === 0 ? '等待审核' : '提交认证' }}
      </button>
      <view class="notice" v-if="status === 0">资料已提交，等待平台核验。</view>
      <view class="notice danger" v-if="status === 2">
        未通过：{{ rejectReason || '资料不完整' }}
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/api/index.js'
export default {
  data() {
    return {
      form: { realName: '', idCard: '' },
      status: -1,
      maskedName: '',
      rejectReason: '',
      submitting: false,
      loading: true,
      loadError: ''
    }
  },
  onLoad() {
    this.loadProfile()
  },
  methods: {
    async loadProfile() {
      this.loading = true
      this.loadError = ''
      try {
        const res = await api.getUserProfile()
        const u = res.data
        this.status = u.realNameVerified
          ? 1
          : u.realNameStatus === 0
            ? 0
            : u.realNameStatus === 2
              ? 2
              : -1
        this.maskedName = u.realName || ''
        this.rejectReason = u.realNameRejectReason || ''
      } catch (e) {
        this.loadError = '认证信息加载失败'
      } finally {
        this.loading = false
      }
    },
    async submit() {
      if (this.submitting || this.status === 0) return
      if (!this.form.realName || this.form.realName.length < 2) {
        uni.showToast({ title: '请填写真实姓名', icon: 'none' })
        return
      }
      if (!/^\d{17}[\dXx]$/.test(this.form.idCard)) {
        uni.showToast({ title: '身份证号格式不正确', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        await api.submitRealName(this.form)
        this.status = 0
        uni.showToast({ title: '已提交', icon: 'success' })
      } catch (e) {
      } finally {
        this.submitting = false
      }
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
.tip {
  font-size: var(--font-caption);
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 20rpx;
}
.row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--canvas);
}
.row:last-child {
  border-bottom: none;
}
.label {
  width: 160rpx;
  color: var(--muted);
  font-size: var(--font-body);
}
.input {
  flex: 1;
  font-size: var(--font-body);
}
.submit {
  margin: 30rpx 24rpx;
  background: var(--primary);
  color: #fff;
  border-radius: 20rpx;
  height: 48px;
  line-height: 48px;
  font-size: var(--font-control);
}
.notice {
  text-align: center;
  color: #fa8c16;
  font-size: var(--font-caption);
}
.notice.danger {
  color: #e54d42;
}
.done {
  font-size: 16px;
  color: #52c41a;
  font-weight: 600;
}
.sub {
  margin-top: 12rpx;
  font-size: var(--font-small);
  color: var(--muted);
}
</style>
