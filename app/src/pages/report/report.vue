<template>
  <view class="page">
    <cu-custom isBack>
      <template #content>举报信息</template>
    </cu-custom>

    <view class="card">
      <view class="form-row">
        <text class="label">类型</text>
        <picker :range="typeNames" @change="onTypeChange">
          <view class="picker">{{ typeNames[typeIndex] }}</view>
        </picker>
      </view>

      <view class="form-row column">
        <text class="label">说明</text>
        <textarea aria-label="举报说明" class="textarea" v-model="reason" maxlength="500"
          placeholder="写清楚哪一条信息有问题、问题是什么，便于核实" />
      </view>

      <view class="form-row column">
        <text class="label">凭证（选填）</text>
        <view class="images">
          <view class="img-box" v-for="(img, i) in images" :key="i">
            <image :src="img" mode="aspectFill" @tap="preview(i)" />
            <text class="del" @tap="remove(i)">×</text>
          </view>
          <view class="img-add" v-if="images.length < 3" @tap="choose">+</view>
        </view>
      </view>

      <button role="button" class="submit" :loading="submitting" @tap="submit">提交举报</button>
      <view class="notice">举报会通知平台运营人工核实，核实属实会对该信息下架或标记发布者。</view>
    </view>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { content, loadContent, dictionary, labelFor } from '@/utils/content'

export default {
  data() {
    return {
      jobId: '',
      content,
      typeIndex: 0,
      reason: '',
      images: [],
      submitting: false
    }
  },
  computed: { typeNames() { return dictionary('reportTypes').map(x => x.label) } },
  onLoad(options) {
    loadContent().catch(() => {})
    this.jobId = options.id || ''
  },
  methods: {
    labelFor,
    onTypeChange(e) {
      this.typeIndex = Number(e.detail.value)
    },
    choose() {
      uni.chooseImage({
        count: 3 - this.images.length,
        success: (res) => {
          this.images = this.images.concat(res.tempFilePaths).slice(0, 3)
        }
      })
    },
    preview(index) {
      uni.previewImage({ current: this.images[index], urls: this.images })
    },
    remove(index) {
      this.images.splice(index, 1)
    },
    async submit() {
      if (String(this.reason).trim().length < 5) {
        uni.showToast({ title: '请说明举报原因', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const evidence = []
        for (const p of this.images) {
          let fileID = ''
          for (let attempt = 0; attempt < 2 && !fileID; attempt++) {
            try {
              fileID = await api.uploadFile(p, 'report')
            } catch (e) {
              if (attempt === 1) throw e
            }
          }
          evidence.push(fileID)
        }
        await api.submitReport({
          jobId: this.jobId,
          reportType: dictionary('reportTypes')[this.typeIndex].value,
          reason: this.reason,
          evidence
        })
        uni.showToast({ title: '已提交', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 800)
      } catch (e) {
        // 请求层已提示
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--canvas); }
.card { background: #fff; margin: 24rpx 32rpx; border-radius: 24rpx; padding: 28rpx; }
.form-row { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid var(--canvas); }
.form-row.column { flex-direction: column; align-items: flex-start; }
.label { width: 140rpx; color: var(--muted); font-size: var(--font-body); flex-shrink: 0; }
.picker { font-size: var(--font-body); color: var(--text); }
.textarea { width: 100%; height: 200rpx; font-size: var(--font-body); margin-top: 12rpx; background: #f7f8fa; border-radius: 12rpx; padding: 20rpx; box-sizing: border-box; }
.images { display: flex; flex-wrap: wrap; margin-top: 12rpx; }
.img-box { position: relative; width: 160rpx; height: 160rpx; margin: 0 16rpx 16rpx 0; }
.img-box image { width: 160rpx; height: 160rpx; border-radius: 12rpx; }
.del { position: absolute; top: -10rpx; right: -10rpx; width: 36rpx; height: 36rpx; line-height: 32rpx; text-align: center; background: rgba(0, 0, 0, 0.6); color: #fff; border-radius: 50%; font-size: var(--font-caption); }
.img-add { width: 160rpx; height: 160rpx; border: 2rpx dashed #d9d9d9; border-radius: 12rpx; text-align: center; line-height: 156rpx; font-size: var(--font-display); color: #d9d9d9; }
.submit { margin-top: 28rpx; background: #e54d42; color: #fff; border-radius: 20rpx; height: 48px; line-height: 48px; font-size: var(--font-control); }
.notice { font-size: var(--font-caption); color: var(--muted); margin-top: 16rpx; line-height: 1.6; }
</style>