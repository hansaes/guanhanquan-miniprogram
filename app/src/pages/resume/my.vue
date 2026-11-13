<template>
  <view class="ui-page resume-page">
    <cu-custom :is-back="true"><template #content>我的简历</template></cu-custom>
    <auth-gate title="登录后管理简历" @ready="load">
      <view class="ui-body">
        <page-state v-if="loading || error" :loading="loading" :error="error" @retry="load" />
        <view v-else class="ui-enter">
          <view class="status-card">
            <view>
              <text class="status-title">
                {{ !profile.id ? '创建你的简历' : profile.status === 0 ? '正在找活' : '暂不找活' }}
              </text>
              <text class="status-note">
                {{
                  !profile.id
                    ? '完善资料后可公开求职'
                    : profile.status === 0
                      ? '向招工方展示简历'
                      : '已暂停简历展示'
                }}
              </text>
            </view>
            <switch
              :checked="!!profile.id && profile.status === 0"
              :disabled="saving || !profile.id"
              color="#7ca6ff"
              aria-label="公开求职简历"
              @change="changeStatus"
            />
          </view>
          <view v-if="profile.reviewStatus === 0" class="review-note">简历审核中</view>
          <view v-else-if="profile.reviewStatus === 2" class="review-note rejected">
            {{ profile.rejectReason || '请完善资料后重新提交' }}
          </view>
          <view class="ui-card profile-card">
            <view class="profile-header">
              <view class="ui-avatar large">
                <image v-if="profile.avatar" :src="profile.avatar" mode="aspectFill" />
                <uni-icons v-else type="person-filled" size="36" color="#7c94bd" />
              </view>
              <view class="profile-main">
                <text class="name">{{ profile.name || '完善你的简历' }}</text>
                <text class="meta">
                  {{ [profile.workExperience, profile.expectArea].filter(Boolean).join(' · ') }}
                </text>
              </view>
              <button role="button" class="ui-text-button" @tap="edit">编辑</button>
            </view>
            <view class="contact-row">
              <uni-icons type="phone-filled" size="21" color="#98a1ae" />
              <text>{{ maskedPhone || '未填写电话' }}</text>
            </view>
            <view v-if="profile.wechat" class="contact-row">
              <uni-icons type="weixin" size="21" color="#98a1ae" />
              <text>{{ profile.wechat }}</text>
            </view>
          </view>
          <view class="ui-card">
            <view class="ui-section-heading">
              <view class="heading">
                <uni-icons type="settings-filled" size="23" color="#3981f5" />
                <text class="ui-title">工种与技能</text>
              </view>
              <button role="button" class="ui-text-button" @tap="edit">编辑</button>
            </view>
            <text class="field-label">主攻工种</text>
            <view class="tags">
              <text v-for="type in profile.jobTypes" :key="type" class="ui-tag blue">{{
                type
              }}</text>
              <text v-if="!profile.jobTypes.length" class="missing">未填写</text>
            </view>
            <text class="field-label">持有证书</text>
            <view class="tags">
              <text v-if="profile.certificateInfo" class="ui-tag green">
                {{ labelFor('certificates', profile.certificateInfo, profile.certificateInfo) }}
              </text>
              <text v-else class="missing">未填写</text>
            </view>
            <text class="field-label">技术描述</text>
            <text class="description">{{ profile.techDescription || '未填写' }}</text>
          </view>
          <view class="ui-card">
            <view class="ui-section-heading">
              <view class="heading">
                <uni-icons type="location" size="23" color="#3981f5" />
                <text class="ui-title">求职意向</text>
              </view>
              <button role="button" class="ui-text-button" @tap="edit">编辑</button>
            </view>
            <view class="intention-grid">
              <view>
                <text class="field-label">期望地区</text>
                <text>{{ profile.expectArea || '未填写' }}</text>
              </view>
              <view>
                <text class="field-label">期望薪资</text>
                <text class="salary">{{ profile.expectSalary || '面议' }}</text>
              </view>
              <view>
                <text class="field-label">到岗时间</text>
                <text>
                  {{
                    labelFor(
                      'availability',
                      profile.availableTime,
                      profile.availableTime || '未填写'
                    )
                  }}
                </text>
              </view>
              <view>
                <text class="field-label">工作年限</text>
                <text>
                  {{
                    labelFor(
                      'experience',
                      profile.workExperience,
                      profile.workExperience || '未填写'
                    )
                  }}
                </text>
              </view>
            </view>
          </view>
          <button role="button"
            class="ui-button ui-button-ghost"
            :loading="saving"
            :disabled="saving"
            @tap="profile.id ? refresh() : edit()"
          >
            {{ profile.id ? '刷新简历' : '创建简历' }}
          </button>
        </view>
      </view>
    </auth-gate>
  </view>
</template>
<script>
import api from '@/api/index.js'
import { loadContent, labelFor } from '@/utils/content'
import { session } from '@/utils/auth'
export default {
  data: () => ({
    session,
    loadedOnce: false,
    loading: true,
    error: '',
    saving: false,
    profile: { jobTypes: [], status: 1 }
  }),
  computed: {
    maskedPhone() {
      return String(this.profile.contactPhone || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
    }
  },
  onShow() {
    loadContent().catch(() => {})
    if (this.loadedOnce && session.authReady && session.userInfo) this.load()
  },
  methods: {
    labelFor,
    async load() {
      this.loading = true
      this.error = ''
      try {
        const r = await api.getWorkerProfile()
        this.profile = { ...r.data, jobTypes: r.data.jobTypes || [] }
      } catch (e) {
        this.error = '简历加载失败，请重试'
      } finally {
        this.loading = false
        this.loadedOnce = true
      }
    },
    edit() {
      uni.navigateTo({ url: '/pages/resume/edit' })
    },
    async changeStatus(e) {
      if (this.saving) return
      const previous = this.profile.status
      this.profile.status = e.detail.value ? 0 : 1
      this.saving = true
      try {
        await api.updateWorkerProfile({ status: this.profile.status })
      } catch (e) {
        this.profile.status = previous
      } finally {
        this.saving = false
      }
    },
    async refresh() {
      if (this.saving) return
      this.saving = true
      try {
        await api.updateWorkerProfile({ status: this.profile.status })
        uni.showToast({ title: '简历已刷新', icon: 'success' })
      } catch (e) {
      } finally {
        this.saving = false
      }
    }
  }
}
</script>
<style scoped>
.resume-page {
  padding-bottom: env(safe-area-inset-bottom);
}
.status-card {
  background: #2563eb;
  color: #fff;
  border-radius: 28rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 32rpx;
}
.status-title {
  display: block;
  font-size: var(--font-title);
  font-weight: 650;
}
.status-note {
  display: block;
  font-size: var(--font-small);
  color: #dbe7ff;
  margin-top: 10rpx;
}
.profile-header {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
  margin-bottom: 30rpx;
}
.large {
  width: 112rpx;
  height: 112rpx;
}
.profile-main {
  flex: 1;
  min-width: 0;
  padding-top: 8rpx;
}
.name {
  display: block;
  font-size: var(--font-title);
  font-weight: 650;
}
.meta {
  display: block;
  margin-top: 14rpx;
  color: var(--muted);
  font-size: var(--font-small);
  line-height: 1.6;
}
.contact-row {
  display: flex;
  gap: 20rpx;
  align-items: center;
  color: #5b6778;
  font-size: var(--font-control);
  padding: 12rpx 0;
}
.heading {
  display: flex;
  gap: 16rpx;
  align-items: center;
}
.field-label {
  display: block;
  color: var(--muted);
  font-size: var(--font-small);
  margin-bottom: 16rpx;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 30rpx;
}
.tags .ui-tag {
  border-radius: 40rpx;
  padding: 8rpx 24rpx;
  font-size: var(--font-small);
}
.missing {
  color: var(--muted);
}
.description {
  font-size: var(--font-control);
  color: var(--text);
  line-height: 1.85;
  white-space: pre-wrap;
}
.intention-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32rpx 24rpx;
  font-size: var(--font-control);
  color: var(--text);
}
.salary {
  font-weight: 600;
}
.review-note {
  margin: -8rpx 0 24rpx;
  padding: 18rpx 24rpx;
  border-radius: 12rpx;
  color: #aa6a0a;
  background: #fff4df;
  font-size: var(--font-small);
}
.rejected {
  background: #fff0ef;
  color: #bf4343;
}
</style>
