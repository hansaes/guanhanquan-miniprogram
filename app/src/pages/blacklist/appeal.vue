<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>申诉</template></cu-custom>

    <view class="card">
      <view class="tip">如果你认为自己被错误标记，请提交申诉。平台会核实证据，属实的标记会被撤销。</view>
      <view class="row">
        <text class="label">手机号</text>
        <input aria-label="手机号" class="input" type="number" maxlength="11" v-model="phone" placeholder="被标记的手机号" />
      </view>
      <view class="row column">
        <text class="label">申诉理由</text>
        <textarea aria-label="举报说明" class="textarea" v-model="reason" maxlength="500"
          placeholder="说明情况，例如：工资已结清、举报内容不实，并附可核实的证明" />
      </view>
      <button role="button" class="submit" :loading="submitting" @tap="submit">提交申诉</button>
    </view>
  </view>
</template>

<script>
import api from '@/api/index.js'
export default {
  data() {
    return { phone: '', reason: '', submitting: false }
  },
  onLoad(options) {
    if (options.phone) this.phone = options.phone
  },
  methods: {
    async submit() {
      if (!/^1\d{10}$/.test(this.phone)) return uni.showToast({ title: '请填写正确手机号', icon: 'none' })
      if (String(this.reason).trim().length < 10) return uni.showToast({ title: '理由至少 10 个字', icon: 'none' })
      this.submitting = true
      try {
        await api.submitAppeal({ phone: this.phone, reason: this.reason })
        uni.showToast({ title: '已提交，等待核实', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 1000)
      } catch (e) {} finally { this.submitting = false }
    }
  }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--canvas); }
.card { background: #fff; margin: 24rpx 32rpx; border-radius: 24rpx; padding: 28rpx; }
.tip { font-size: var(--font-caption); color: var(--muted); line-height: 1.6; margin-bottom: 20rpx; }
.row { display: flex; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid var(--canvas); }
.row.column { flex-direction: column; align-items: flex-start; }
.label { width: 140rpx; color: var(--muted); font-size: var(--font-body); }
.input { flex: 1; font-size: var(--font-body); }
.textarea { width: 100%; height: 180rpx; background: #f7f8fa; border-radius: 12rpx; padding: 20rpx; font-size: var(--font-body); margin-top: 12rpx; box-sizing: border-box; }
.submit { margin-top: 28rpx; background: var(--primary); color: #fff; border-radius: 20rpx; height: 48px; line-height: 48px; font-size: var(--font-control); }
</style>