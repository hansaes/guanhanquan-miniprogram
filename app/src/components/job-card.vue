<template>
  <view class="job-card ui-enter" :class="{ urgent: job.isUrgent }">
    <button
      class="job-summary"
      role="button"
      :aria-label="job.title + '，' + salaryText(job)"
      @tap="goToDetail"
    >
      <view class="job-header">
        <text class="job-title">{{ job.title }}</text>
        <text class="job-salary">{{ salaryText(job) }}</text>
      </view>
      <view
        v-if="job.isUrgent || job.isTop || job.employerVerified || tags.length"
        class="job-tags"
      >
        <text v-if="job.isUrgent" class="ui-tag orange">{{ content.badges.urgent }}</text>
        <text v-if="job.isTop" class="ui-tag blue">{{ content.badges.top }}</text>
        <text v-if="job.employerVerified && !job.isTop" class="ui-tag blue">
          {{ content.badges.verified }}
        </text>
        <text v-for="tag in tags" :key="tag" class="ui-tag">{{ tag }}</text>
      </view>
      <view class="job-meta">
        <view class="location">
          <uni-icons type="location-filled" size="14" color="#808a99" />
          <text>{{ job.workArea }}</text>
        </view>
        <text class="time">{{ timeAgo(job.createdAt) }}</text>
      </view>
    </button>
    <view class="job-footer">
      <view class="contact">
        <view class="avatar">
          <image v-if="job.employerAvatar" :src="job.employerAvatar" mode="aspectFill" />
          <uni-icons v-else type="person-filled" size="20" color="#7c94bd" />
        </view>
        <text class="company">{{ job.contactName || job.employerName || '招工方' }}</text>
        <uni-icons v-if="job.employerVerified" type="checkbox-filled" size="14" color="#3981f5" />
      </view>
      <button class="contact-btn" role="button" @tap.stop="goToDetail">查看电话</button>
    </view>
  </view>
</template>
<script>
import { salaryText, timeAgo } from '@/utils/job'
import { content, labelFor } from '@/utils/content'
export default {
  props: { job: { type: Object, default: () => ({}) } },
  data: () => ({ content }),
  computed: {
    tags() {
      return [
        ...new Set(
          [
            labelFor('certificates', this.job.certificateReq, this.job.certificateReq),
            this.job.accommodation === 1 ? labelFor('accommodation', 1) : '',
            this.job.travelReimburse === 1 ? labelFor('travel', 1) : '',
            this.job.duration
          ].filter(Boolean)
        )
      ].slice(0, 3)
    }
  },
  methods: {
    salaryText,
    timeAgo,
    goToDetail() {
      uni.navigateTo({ url: '/pages/jobDetail/jobDetail?id=' + encodeURIComponent(this.job.id) })
    }
  }
}
</script>
<style scoped>
.job-card {
  position: relative;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.job-card.urgent {
  border-left: 6rpx solid #fb791f;
  padding-left: 26rpx;
}
.job-summary {
  display: block;
  width: 100%;
  padding: 0;
  margin: 0;
  background: transparent;
  text-align: left;
  line-height: 1.5;
  border-radius: 0;
}
.job-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16rpx;
  align-items: baseline;
}
.job-title {
  flex: 1 1 180rpx;
  min-width: 0;
  font-size: var(--font-title);
  line-height: 1.4;
  font-weight: 650;
  color: var(--ink);
}
.job-salary {
  max-width: 100%;
  overflow-wrap: anywhere;
  color: var(--salary);
  font-size: var(--font-heading);
  font-weight: 700;
  flex-shrink: 0;
}
.job-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin: 22rpx 0;
}
.job-meta {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  color: var(--muted);
  font-size: var(--font-caption);
  margin-top: 20rpx;
}
.location {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex: 1;
  min-width: 0;
}
.time {
  flex-shrink: 0;
}
.job-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  border-top: 1rpx solid var(--line);
  margin-top: 28rpx;
  padding-top: 24rpx;
}
.contact {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
  flex: 1;
}
.avatar {
  height: 48rpx;
  width: 48rpx;
  border-radius: 50%;
  background: #edf3ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.avatar image {
  width: 100%;
  height: 100%;
}
.company {
  font-size: var(--font-small);
  color: var(--text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.contact-btn {
  background: var(--primary);
  color: #fff;
  font-size: var(--font-small);
  line-height: 44px;
  min-height: 44px;
  border-radius: 40rpx;
  padding: 0 30rpx;
  margin: 0;
}
</style>
