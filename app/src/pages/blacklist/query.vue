<template>
  <view class="page">
    <cu-custom isBack>
      <template #content>黑老板查询</template>
    </cu-custom>

    <view class="card">
      <view class="tip">输入老板手机号，查看是否被工人举报过。仅展示平台核实过的记录。</view>
      <view class="search-row">
        <input aria-label="手机号" class="phone-input" type="number" maxlength="11" v-model="phone" placeholder="请输入 11 位手机号" />
        <button role="button" class="search-btn" :loading="loading" @tap="query">查询</button>
      </view>
    </view>

    <view class="card result" v-if="result">
      <view v-if="result.cost" class="cost-tip">本次查询消耗 {{ result.cost }} 积分</view>
      <view v-if="result.count === 0" class="safe">
        <text class="safe-title">暂无记录</text>
        <text class="safe-desc">该号码没有被核实的举报记录，但仍建议先电话确认工地与工钱。</text>
      </view>
      <view v-else>
        <view class="danger-title">该号码有 {{ result.count }} 条核实记录</view>
        <view class="reason-list">
          <view class="reason-item" v-for="(r, i) in result.reasons" :key="i">
            <text class="reason-name">{{ r.name }}</text>
            <text class="reason-count">{{ r.count }} 次</text>
          </view>
        </view>
        <view class="appeal" @tap="appeal">如果你是被标记方，点此提交申诉</view>
        <view class="record" v-for="(rec, i) in result.records" :key="i">
          <view class="record-head">
            <text class="record-type">{{ labelFor('blacklistReasons', rec.reasonType, rec.reasonName) }}</text>
            <text class="record-time">{{ formatDate(rec.createdAt) }}</text>
          </view>
          <text class="record-detail">{{ rec.detail }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="section-title">我要举报</view>
      <view class="form-row">
        <text class="label">号码</text>
        <input aria-label="老板手机号" class="input" type="number" maxlength="11" v-model="form.bossPhone" placeholder="老板手机号" />
      </view>
      <view class="form-row">
        <text class="label">称呼</text>
        <input aria-label="老板称呼" class="input" v-model="form.bossName" placeholder="如：张老板（可不填）" />
      </view>
      <view class="form-row">
        <text class="label">原因</text>
        <picker :range="reasonNames" @change="onReasonChange">
          <view class="picker">{{ reasonNames[form.reasonIndex] }}</view>
        </picker>
      </view>
      <view class="form-row column">
        <text class="label">说明</text>
        <textarea aria-label="举报说明" class="textarea" v-model="form.reasonDetail" maxlength="500"
          placeholder="写清楚时间、地点、欠了多少钱、对方怎么答复（至少 10 个字，便于核实）" />
      </view>
      <view class="form-row column">
        <text class="label">证据（选填）</text>
        <view class="images">
          <view class="img-box" v-for="(img, i) in images" :key="i">
            <image :src="img" mode="aspectFill" @tap="preview(i)" />
            <text class="del" @tap="remove(i)">×</text>
          </view>
          <view class="img-add" v-if="images.length < 3" @tap="choose">+</view>
        </view>
      </view>
      <button role="button" class="submit" :loading="submitting" @tap="submit">提交举报</button>
      <view class="notice">举报需人工核实，恶意举报会被封号。核实通过后其他工人才能看到。</view>
    </view>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { content, loadContent, dictionary, labelFor } from '@/utils/content'

export default {
  data() {
    return {
      phone: '',
      loading: false,
      result: null,
      submitting: false,
      content,
      images: [],
      form: { bossPhone: '', bossName: '', reasonIndex: 0, reasonDetail: '' }
    }
  },
  computed: { reasonNames() { return dictionary('blacklistReasons').map(x => x.label) } },
  onLoad(options) {
    loadContent().catch(() => {})
    if (options.phone) this.phone = options.phone
  },
  methods: {
    labelFor,
    formatDate(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
    },
    async query() {
      const phone = String(this.phone || '').trim()
      if (!/^1\d{10}$/.test(phone)) {
        uni.showToast({ title: '请输入 11 位手机号', icon: 'none' })
        return
      }
      this.loading = true
      try {
        const res = await api.queryBlacklist(phone)
        this.result = res.data
        this.form.bossPhone = phone
      } catch (e) {
        this.result = null
      } finally {
        this.loading = false
      }
    },
    appeal() {
      uni.navigateTo({ url: '/pages/blacklist/appeal?phone=' + (this.phone || '') })
    },
    onReasonChange(e) {
      this.form.reasonIndex = Number(e.detail.value)
    },
    choose() {
      uni.chooseImage({
        count: 3 - this.images.length,
        sizeType: ['compressed'],
        success: (res) => { this.images = this.images.concat(res.tempFilePaths).slice(0, 3) }
      })
    },
    preview(i) {
      uni.previewImage({ current: this.images[i], urls: this.images })
    },
    remove(i) {
      this.images.splice(i, 1)
    },
    async submit() {
      if (!/^1\d{10}$/.test(String(this.form.bossPhone))) {
        uni.showToast({ title: '请填写正确手机号', icon: 'none' })
        return
      }
      if (String(this.form.reasonDetail).trim().length < 10) {
        uni.showToast({ title: '说明至少 10 个字', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const evidence = []
        for (const p of this.images) {
          let fileID = ''
          for (let attempt = 0; attempt < 2 && !fileID; attempt++) {
            try {
              fileID = await api.uploadFile(p, 'blacklist')
            } catch (e) {
              if (attempt === 1) throw e
            }
          }
          evidence.push(fileID)
        }
        await api.submitBlacklist({
          bossPhone: this.form.bossPhone,
          bossName: this.form.bossName,
          reasonType: dictionary('blacklistReasons')[this.form.reasonIndex].value,
          reasonDetail: this.form.reasonDetail,
          evidence
        })
        uni.showToast({ title: '已提交，等待核实', icon: 'success' })
        this.form.reasonDetail = ''
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
.page { min-height: 100vh; background: var(--canvas); padding-bottom: 40rpx; }
.card { background: #fff; margin: 24rpx 32rpx; border-radius: 24rpx; padding: 28rpx; }
.tip { font-size: var(--font-caption); color: var(--muted); line-height: 1.6; margin-bottom: 20rpx; }
.search-row { display: flex; align-items: center; }
.phone-input { flex: 1; height: 48px; background: var(--canvas); border-radius: 40rpx; padding: 0 28rpx; font-size: var(--font-control); }
.search-btn { margin-left: 16rpx; background: var(--primary); color: #fff; font-size: var(--font-body); border-radius: 40rpx; height: 48px; line-height: 48px; padding: 0 32rpx; }
.safe-title { display: block; font-size: 16px; color: #52c41a; font-weight: 600; margin-bottom: 12rpx; }
.safe-desc { font-size: var(--font-small); color: #888; line-height: 1.6; }
.danger-title { font-size: 16px; color: #e54d42; font-weight: 600; margin-bottom: 16rpx; }
.reason-list { display: flex; flex-wrap: wrap; margin-bottom: 16rpx; }
.reason-item { background: #fff1f0; border-radius: 8rpx; padding: 8rpx 16rpx; margin: 0 12rpx 12rpx 0; }
.reason-name { font-size: var(--font-caption); color: #e54d42; }
.reason-count { font-size: var(--font-caption); color: #e54d42; margin-left: 8rpx; }
.appeal { color: var(--primary); font-size: var(--font-small); padding: 16rpx 0; }
.record { border-top: 1rpx solid #f0f0f0; padding-top: 16rpx; margin-top: 16rpx; }
.record-head { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.record-type { font-size: var(--font-small); color: var(--text); font-weight: 600; }
.record-time { font-size: var(--font-caption); color: var(--muted); }
.record-detail { font-size: var(--font-small); color: var(--muted); line-height: 1.6; }
.section-title { font-size: var(--font-control); font-weight: 600; margin-bottom: 20rpx; }
.form-row { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid var(--canvas); }
.form-row.column { flex-direction: column; align-items: flex-start; }
.label { width: 110rpx; color: var(--muted); font-size: var(--font-body); flex-shrink: 0; }
.input { flex: 1; font-size: var(--font-body); height: 56rpx; }
.picker { font-size: var(--font-body); color: var(--text); }
.textarea { width: 100%; height: 180rpx; font-size: var(--font-body); margin-top: 12rpx; background: #f7f8fa; border-radius: 12rpx; padding: 20rpx; box-sizing: border-box; }
.submit { margin-top: 28rpx; background: #e54d42; color: #fff; border-radius: 20rpx; height: 48px; line-height: 48px; font-size: var(--font-control); }
.notice { font-size: var(--font-caption); color: var(--muted); margin-top: 16rpx; line-height: 1.6; }
.cost-tip { font-size: var(--font-caption); color: #fa8c16; margin-bottom: 12rpx; }
.images { display: flex; flex-wrap: wrap; margin-top: 12rpx; }
.img-box, .img-add { width: 130rpx; height: 130rpx; margin: 0 14rpx 14rpx 0; border-radius: 10rpx; overflow: hidden; position: relative; }
.img-box image { width: 100%; height: 100%; }
.img-add { border: 1rpx dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 26px; color: #bbb; }
.del { position: absolute; top: 0; right: 0; width: 38rpx; height: 38rpx; line-height: 38rpx; text-align: center; background: rgba(0,0,0,.5); color: #fff; font-size: var(--font-caption); }
</style>