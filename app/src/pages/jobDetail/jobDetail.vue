<template>
  <view class="ui-page detail">
    <cu-custom isBack><template #content>招工详情</template></cu-custom>
    <page-state
      v-if="loading || !job"
      :loading="loading"
      :error="error"
      empty-text="信息不存在或已下架"
      @retry="load"
    />
    <view v-else class="ui-enter">
      <view class="detail-section summary">
        <view class="title-row">
          <text class="job-title">{{ job.title }}</text>
          <text class="amount">{{ salaryText(job) }}</text>
        </view>
        <view class="badges">
          <text v-if="job.isUrgent" class="ui-tag orange">{{ content.badges.urgent }}</text>
          <text v-if="job.employerVerified" class="ui-tag blue">{{ content.badges.verified }}</text>
          <text v-if="job.isTop" class="ui-tag blue">{{ content.badges.top }}</text>
        </view>
        <view class="facts">
          <view>
            <text class="fact-label">工期信息</text>
            <text>{{ job.duration || '面议' }}</text>
          </view>
          <view>
            <text class="fact-label">工作地点</text>
            <text>{{ job.workArea }}</text>
          </view>
        </view>
        <view v-if="job.workAddress" class="address">
          <text class="fact-label">详细地址</text>
          <view>
            <uni-icons type="location-filled" size="18" color="#3981f5" />
            <text>
              {{ job.workAddress }}
            </text>
          </view>
        </view>
      </view>
      <view class="detail-section">
        <view class="section-title">岗位要求</view>
        <view class="row">
          <text class="label">证书要求</text>
          <text class="value">
            {{ labelFor('certificates', job.certificateReq, job.certificateReq || '不限') }}
          </text>
        </view>
        <view class="row">
          <text class="label">技术要求</text>
          <text class="value">{{ job.techReq || '不限' }}</text>
        </view>
        <view class="row">
          <text class="label">年龄限制</text>
          <text class="value">{{ job.ageLimit || '不限' }}</text>
        </view>
        <view v-if="job.otherReq" class="row">
          <text class="label">其他要求</text>
          <text class="value">{{ job.otherReq }}</text>
        </view>
      </view>
      <view class="detail-section">
        <view class="section-title">待遇福利</view>
        <view class="row">
          <text class="label">薪资发放</text>
          <text class="value">{{ payTypeText }}</text>
        </view>
        <view class="row">
          <text class="label">食宿安排</text>
          <text class="value">{{ accommodationText }}</text>
        </view>
        <view class="row">
          <text class="label">路费报销</text>
          <text class="value">{{ travelText }}</text>
        </view>
        <view v-if="job.otherBenefits" class="row">
          <text class="label">其他福利</text>
          <text class="value">{{ job.otherBenefits }}</text>
        </view>
      </view>
      <view class="detail-section contact-section">
        <view class="publisher">
          <view class="ui-avatar">
            <uni-icons type="person-filled" size="28" color="#7c94bd" />
          </view>
          <view class="publisher-name">
            <view class="publisher-title">
              <text>{{ job.contactName || job.employerName || '招工方' }}</text>
              <uni-icons
                v-if="job.employerVerified"
                aria-label="企业已认证"
                type="checkbox-filled"
                size="18"
                color="#3981f5"
              />
            </view>
            <text
              v-if="job.employerName && job.employerName !== job.contactName"
              class="publisher-company"
              >{{ job.employerName }}</text
            >
          </view>
          <button role="button" class="report" @tap="reportJob">举报</button>
        </view>
        <view class="phone-row">
          <text>{{ job.contactPhone }}{{ job.wechatSame ? ' · 微信同号' : '' }}</text>
          <button role="button" @tap="queryBlack">信用查询</button>
        </view>
        <button
          role="button"
          v-if="!job.isOwner"
          class="apply"
          :disabled="applied || applying"
          :loading="applying"
          @tap="applyJob"
        >
          {{ applied ? '已报名' : '报名此岗位' }}
        </button>
      </view>
      <view v-if="content.safetyNotice" class="safety">
        <uni-icons type="info" size="15" color="#8b95a5" />
        <text>{{ content.safetyNotice }}</text>
      </view>
    </view>
    <view v-if="job" class="bottom-bar">
      <button
        role="button"
        class="icon-action"
        :aria-label="favorited ? '取消收藏' : '收藏'"
        @tap="toggleFavorite"
      >
        <uni-icons
          :type="favorited ? 'star-filled' : 'star'"
          size="25"
          :color="favorited ? '#2563eb' : '#8a94a3'"
        />
        <text>{{ favorited ? '已收藏' : '收藏' }}</text>
      </button>
      <button role="button" class="icon-action" open-type="share">
        <uni-icons type="redo" size="25" color="#8a94a3" />
        <text>分享</text>
      </button>
      <button
        role="button"
        class="ui-button primary"
        :loading="unlocking"
        :disabled="unlocking"
        @tap="job.isOwner ? goManage() : contact()"
      >
        {{ job.isOwner ? '管理信息' : job.contactUnlocked ? '一键拨号' : '查看电话' }}
      </button>
    </view>
  </view>
</template>
<script>
import api from '@/api/index.js'
import { salaryText } from '@/utils/job'
import { content, loadContent, labelFor } from '@/utils/content'
import { session, isLoggedIn, requireLogin } from '@/utils/auth'

export default {
  data() {
    return {
      content,
      error: '',
      session,
      applying: false,
      jobId: '',
      job: null,
      loading: true,
      applied: false,
      favorited: false,
      unlocking: false
    }
  },
  computed: {
    payTypeText() {
      return labelFor('payTypes', this.job && this.job.payType, '面议')
    },
    accommodationText() {
      return labelFor('accommodation', this.job && this.job.accommodation, '面议')
    },
    travelText() {
      return labelFor('travel', this.job && this.job.travelReimburse, '面议')
    }
  },
  onLoad(options) {
    this.jobId = options.id || options.jobId || ''
    if (!this.jobId) {
      this.loading = false
      return
    }
    loadContent().catch(() => {})
    this.load()
  },
  onShareAppMessage() {
    return {
      title: this.job ? this.job.title + ' ' + salaryText(this.job) : '管焊圈招工',
      path: '/pages/jobDetail/jobDetail?id=' + this.jobId
    }
  },
  onShow() {
    if (this.job && session.authReady) this.load()
  },
  watch: {
    'session.authReady'(ready) {
      if (ready && this.job) {
        this.checkApplied()
        this.checkFavorite()
      }
    }
  },
  methods: {
    salaryText,
    labelFor,
    async load() {
      this.loading = true
      this.error = ''
      try {
        const res = await api.getJobDetail(this.jobId)
        this.job = res.data
        await Promise.all([this.checkApplied(), this.checkFavorite()])
      } catch (e) {
        this.job = null
        this.error = e && e.code === 404 ? '信息不存在或已下架' : '招工信息加载失败'
      } finally {
        this.loading = false
      }
    },
    async checkApplied() {
      if (!session.authReady || !isLoggedIn()) {
        this.applied = false
        return
      }
      try {
        const res = await api.checkJobApplication(this.jobId)
        this.applied = res.data.applied
      } catch (e) {
        this.applied = false
      }
    },
    async checkFavorite() {
      if (!session.authReady || !isLoggedIn()) {
        this.favorited = false
        return
      }
      try {
        const res = await api.checkFavorite(this.jobId)
        this.favorited = res.data.favorited
      } catch (e) {
        this.favorited = false
      }
    },
    unlock() {
      if (!requireLogin()) return
      uni.showModal({
        title: '解锁联系方式',
        content: `将消耗 ${this.job.unlockCost} 积分查看老板电话，确认继续？`,
        success: (r) => {
          if (r.confirm) this.doUnlock()
        }
      })
    },
    async doUnlock() {
      if (this.unlocking) return
      this.unlocking = true
      try {
        const res = await api.unlockContact(this.jobId)
        this.job.contactPhone = res.data.contactPhone
        this.job.contactUnlocked = true
        uni.showToast({ title: '已解锁', icon: 'success' })
      } catch (e) {
        // 积分不足等错误已由请求层提示
      } finally {
        this.unlocking = false
      }
    },
    contact() {
      if (this.job.contactUnlocked) this.callPhone()
      else this.unlock()
    },
    callPhone() {
      uni.makePhoneCall({ phoneNumber: this.job.contactPhone })
    },
    async applyJob() {
      if (!requireLogin()) return
      if (this.applied || this.applying) return
      this.applying = true
      try {
        await api.applyForJob(this.jobId, {})
        this.applied = true
        uni.showToast({ title: '报名成功', icon: 'success' })
      } catch (e) {
        // 请求层展示错误
      } finally {
        this.applying = false
      }
    },
    async toggleFavorite() {
      if (!requireLogin()) return
      try {
        const res = await api.toggleFavorite(this.jobId)
        this.favorited = res.data.favorited
      } catch (e) {}
    },
    queryBlack() {
      uni.navigateTo({
        url:
          '/pages/blacklist/query?phone=' + (this.job.contactUnlocked ? this.job.contactPhone : '')
      })
    },
    reportJob() {
      if (!requireLogin()) return
      uni.navigateTo({ url: '/pages/report/report?id=' + this.jobId })
    },
    goManage() {
      uni.navigateTo({ url: '/pages/employer/jobManage' })
    }
  }
}
</script>
<style scoped>
.detail {
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}
.detail-section {
  background: #fff;
  padding: 40rpx 32rpx;
  margin-bottom: 22rpx;
}
.summary {
  padding-top: 42rpx;
  padding-bottom: 48rpx;
}
.title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20rpx;
}
.job-title {
  font-size: var(--font-display);
  font-weight: 700;
  flex: 1;
  min-width: 0;
}
.amount {
  font-size: var(--font-display);
  font-weight: 700;
  color: var(--salary);
  flex-shrink: 0;
}
.badges {
  display: flex;
  gap: 12rpx;
  margin: 22rpx 0 32rpx;
}
.facts {
  border-top: 1rpx solid var(--line);
  padding-top: 28rpx;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32rpx;
  font-size: var(--font-control);
  color: var(--text);
}
.fact-label {
  display: block;
  font-size: var(--font-small);
  color: var(--muted);
  margin-bottom: 10rpx;
}
.address {
  margin-top: 28rpx;
  color: var(--text);
  font-size: var(--font-control);
  line-height: 1.6;
}
.section-title {
  display: flex;
  align-items: center;
  font-size: var(--font-heading);
  font-weight: 650;
  margin-bottom: 26rpx;
}
.section-title::before {
  content: '';
  width: 7rpx;
  height: 30rpx;
  border-radius: 6rpx;
  background: var(--primary);
  margin-right: 16rpx;
}
.row {
  display: flex;
  gap: 24rpx;
  padding: 14rpx 0;
  line-height: 1.75;
  font-size: var(--font-body);
}
.label {
  color: var(--muted);
  width: 155rpx;
  flex-shrink: 0;
}
.value {
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.publisher {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.publisher-name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-control);
  font-weight: 600;
}
.publisher-title {
  display: flex;
  align-items: center;
  gap: 6px;
}
.publisher-title text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.publisher-title :deep(.uni-icons) {
  flex-shrink: 0;
  line-height: 1;
}
.publisher-company {
  display: block;
  font-size: var(--font-caption);
  font-weight: 400;
  color: var(--muted);
  margin-top: 8rpx;
}
.report {
  border: 2rpx solid #5586ff;
  border-radius: 40rpx;
  padding: 0 28rpx;
  color: var(--primary);
  min-height: 44px;
  line-height: 44px;
  font-size: var(--font-small);
  background: #fff;
  margin: 0;
}
.phone-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  margin-top: 22rpx;
  color: var(--muted);
  font-size: var(--font-small);
}
.phone-row button {
  min-height: 44px;
  background: transparent;
  padding: 8rpx 0;
  margin: 0;
  color: var(--primary);
  font-size: var(--font-small);
}
.apply {
  margin-top: 20rpx;
  color: var(--primary);
  background: var(--primary-soft);
  font-size: var(--font-body);
  min-height: 48px;
  line-height: 48px;
  border-radius: 24rpx;
}
.safety {
  display: flex;
  gap: 10rpx;
  padding: 24rpx 40rpx 40rpx;
  font-size: var(--font-caption);
  line-height: 1.65;
  color: #7c8798;
}
.bottom-bar {
  position: fixed;
  z-index: 80;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-top: 1rpx solid var(--line);
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.icon-action {
  display: flex;
  align-items: center;
  flex-direction: column;
  background: transparent;
  color: #778293;
  font-size: var(--font-caption);
  line-height: 1.7;
  padding: 0;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  margin: 0;
}
.primary {
  flex: 1;
  box-shadow: 0 8rpx 20rpx rgba(37, 99, 235, 0.18);
}
.icon-action :deep(.uni-icons) {
  line-height: 1;
}
@media (max-width: 360px) {
  .amount {
    font-size: var(--font-title);
  }
  .job-title {
    font-size: 21px;
  }
}
</style>
