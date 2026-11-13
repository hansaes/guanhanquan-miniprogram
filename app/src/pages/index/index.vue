<template>
  <view class="ui-page ui-tab-page home">
    <cu-custom>
      <template #content>{{ content.brandName || '管焊圈' }}</template>
    </cu-custom>
    <view class="search-panel">
      <view class="search-row">
        <region-picker :value="region" allow-all @change="onRegion">
          <view class="city">
            <uni-icons type="location-filled" size="20" color="#2563eb" />
            <text>{{ city || '全国' }}</text>
            <uni-icons type="bottom" size="12" color="#2563eb" />
          </view>
        </region-picker>
        <view class="search-input">
          <uni-icons type="search" size="20" color="#929ba9" />
          <input
            aria-label="搜索关键词"
            v-model="keyword"
            :placeholder="content.searchPlaceholder || '搜索'"
            confirm-type="search"
            @confirm="reload"
          />
          <button
            role="button"
            v-if="keyword"
            class="clear"
            aria-label="清空搜索"
            @tap="clearSearch"
          >
            <uni-icons type="clear" size="16" color="#929ba9" />
          </button>
        </view>
      </view>
      <view class="filter-row">
        <option-picker
          title="选择工种"
          :options="categoryNames"
          :value="categoryIndex"
          @change="selectCategory"
        >
          <view class="filter" :class="{ active: categoryId }">
            {{ categoryName || '工种' }}
            <uni-icons type="bottom" size="11" />
          </view>
        </option-picker>
        <option-picker
          title="日薪范围"
          :options="salaryOptions"
          :value="salaryIndex"
          @change="selectSalary"
        >
          <view class="filter" :class="{ active: salaryIndex }">
            薪资
            <uni-icons type="bottom" size="11" />
          </view>
        </option-picker>
        <option-picker
          title="发布时间"
          :options="timeOptions"
          :value="timeIndex"
          @change="selectTime"
        >
          <view class="filter" :class="{ active: timeIndex }">
            时间
            <uni-icons type="bottom" size="11" />
          </view>
        </option-picker>
        <button class="filter filter-reset" role="button" @tap="reset">
          <uni-icons :type="hasFilter ? 'reload' : 'settings'" size="17" color="#2563eb" />
          {{ hasFilter ? '重置' : '筛选' }}
        </button>
      </view>
    </view>
    <view class="ui-body">
      <button role="button" v-if="metadataError" class="metadata-error" @tap="initialize(true)">
        {{ metadataError }} · 重试
      </button>
      <view v-if="banners.length" class="banner-wrapper">
        <swiper
          class="banner"
          :indicator-dots="banners.length > 1"
          indicator-color="rgba(255,255,255,.4)"
          indicator-active-color="#fff"
          :autoplay="false"
          circular
        >
          <swiper-item v-for="item in banners" :key="item.id" @tap="bannerTap(item)">
            <image
              v-if="item.imageUrl && !failedImages[item.id]"
              :src="item.imageUrl"
              mode="aspectFill"
              class="banner-image"
              @error="failedImages[item.id] = true"
            />
            <view v-else class="banner-fallback">
              <text>{{ item.title }}</text>
              <uni-icons type="staff-filled" size="70" color="rgba(255,255,255,.35)" />
            </view>
          </swiper-item>
        </swiper>
      </view>
      <view v-if="content.shortcuts.length" class="quick-grid">
        <button
          v-for="item in content.shortcuts"
          :key="item.value"
          class="quick-item"
          role="button"
          :aria-label="item.label"
          :aria-pressed="shortcut === item.value"
          hover-class="quick-pressed"
          :hover-start-time="0"
          :hover-stay-time="120"
          :class="{ chosen: shortcut === item.value }"
          @tap="selectShortcut(item.value)"
        >
          <view class="quick-icon" :class="'tone-' + item.tone">
            <uni-icons :type="item.icon" size="26" :color="tones[item.tone]" />
          </view>
          <text>{{ item.label }}</text>
        </button>
      </view>
      <auth-gate title="登录后查看岗位" target="/pages/index/index" @ready="reload">
        <view v-if="hasFilter" class="result-label">
          <text>{{ total }} 个岗位</text>
          <text v-if="salaryIndex && salaryOptions[salaryIndex]">
            {{ salaryOptions[salaryIndex].label }}
          </text>
          <text v-if="timeIndex && timeOptions[timeIndex]">{{ timeOptions[timeIndex].label }}</text>
        </view>
        <page-state
          v-if="!jobs.length"
          :loading="!metadataReady || loading"
          :error="error"
          empty-text="暂无匹配岗位，试试其他条件"
          @retry="load"
        />
        <view v-else class="job-list">
          <job-card v-for="job in jobs" :key="job.id" :job="job" />
          <button role="button" v-if="error" class="retry-more" @tap="load(false)">
            加载失败，点击重试
          </button>
          <view v-else class="ui-end">
            {{ loading ? '正在加载…' : hasMore ? '上拉加载更多' : '已经到底了' }}
          </view>
        </view>
      </auth-gate>
    </view>
    <app-tabbar :current="0" />
  </view>
</template>
<script>
import api from '@/api/index.js'
import { content, loadContent, dictionary } from '@/utils/content'
import { navigate } from '@/utils/navigation'
import { session } from '@/utils/auth'
export default {
  data: () => ({
    session,
    content,
    keyword: '',
    city: '',
    region: [],
    regionCode: '',
    categories: [],
    categoryId: '',
    categoryName: '',
    salaryIndex: 0,
    timeIndex: 0,
    shortcut: '',
    banners: [],
    metadataError: '',
    metadataReady: false,
    failedImages: {},
    jobs: [],
    loading: false,
    error: '',
    page: 1,
    total: 0,
    hasMore: true,
    requestId: 0,
    tones: { blue: '#2563eb', green: '#16a05a', orange: '#ed670d', purple: '#9250dc' }
  }),
  computed: {
    authenticated() {
      return this.session.authReady && !!this.session.userInfo?.id
    },
    categoryIndex() {
      return this.categories.findIndex((item) => item.id === this.categoryId) + 1
    },
    categoryNames() {
      return ['全部工种', ...this.categories.map((x) => x.name)]
    },
    salaryOptions() {
      return dictionary('salaryRanges')
    },
    timeOptions() {
      return dictionary('timeRanges')
    },
    hasFilter() {
      return !!(
        this.keyword ||
        this.city ||
        this.categoryId ||
        this.salaryIndex ||
        this.timeIndex ||
        this.shortcut
      )
    }
  },
  watch: {
    authenticated(value) {
      if (!value) this.clearJobs()
    }
  },
  onLoad() {
    this.initialize()
  },
  onShow() {
    uni.hideTabBar({ animation: false })
    loadContent().catch(() => {})
  },
  async onPullDownRefresh() {
    try {
      await this.initialize(true)
    } finally {
      uni.stopPullDownRefresh()
    }
  },
  onReachBottom() {
    if (!this.loading && this.hasMore) this.load(false)
  },
  methods: {
    clearJobs() {
      this.requestId++
      this.jobs = []
      this.total = 0
      this.page = 1
      this.hasMore = true
      this.loading = false
      this.error = ''
    },
    clearSearch() {
      this.keyword = ''
      this.reload()
    },
    async initialize(force) {
      const metadata = Promise.allSettled([
        loadContent(force),
        api.getBanners().then((r) => {
          this.banners = r.data || []
        }),
        api.getCategories().then((r) => {
          this.categories = r.data || []
        })
      ])
      const results = await metadata
      this.metadataError =
        results[0].status === 'rejected' || results[2].status === 'rejected'
          ? '筛选内容加载失败'
          : ''
      this.metadataReady = true
      await this.reload()
    },
    async load(reset = true) {
      if (!this.authenticated || !this.metadataReady) return this.clearJobs()
      const requestId = ++this.requestId
      const page = reset ? 1 : this.page + 1
      this.loading = true
      this.error = ''
      if (reset) this.jobs = []
      const range = this.salaryOptions[this.salaryIndex] || {}
      const time = this.timeOptions[this.timeIndex] || {}
      try {
        const res = await api.getJobList({
          page,
          pageSize: 15,
          keyword: this.keyword.trim(),
          city: this.city,
          regionCode: this.regionCode || undefined,
          categoryId: this.categoryId,
          minSalary: range.min || undefined,
          maxSalary: range.max || undefined,
          createdWithin: this.shortcut === 'latest' ? 24 : time.value || undefined,
          isUrgent: this.shortcut === 'urgent' || undefined,
          verified: this.shortcut === 'verified' || undefined,
          sort: this.shortcut === 'salary' ? 'salary' : ''
        })
        if (requestId !== this.requestId || !this.authenticated) return
        this.jobs = reset ? res.data.records : this.jobs.concat(res.data.records)
        this.page = page
        this.total = res.data.total
        this.hasMore = this.jobs.length < this.total
      } catch (e) {
        if (requestId === this.requestId && this.authenticated) this.error = '岗位加载失败，请重试'
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    reload() {
      return this.load(true)
    },
    onRegion(e) {
      this.region = e.detail.value
      this.regionCode = e.detail.code
      this.city = String(this.region[this.region.length - 1] || '').replace(/[省市]$/g, '')
      this.reload()
    },
    selectCategory(e) {
      const c = this.categories[Number(e.detail.value) - 1]
      this.categoryId = c ? c.id : ''
      this.categoryName = c ? c.name : ''
      this.reload()
    },
    selectSalary(e) {
      this.salaryIndex = Number(e.detail.value)
      this.reload()
    },
    selectTime(e) {
      this.timeIndex = Number(e.detail.value)
      this.reload()
    },
    selectShortcut(value) {
      this.shortcut = this.shortcut === value ? '' : value
      this.reload()
    },
    reset() {
      if (!this.hasFilter) {
        uni.navigateTo({ url: '/pages/jobSearch/jobSearch' })
        return
      }
      this.keyword = ''
      this.city = ''
      this.region = []
      this.regionCode = ''
      this.categoryId = ''
      this.categoryName = ''
      this.salaryIndex = 0
      this.timeIndex = 0
      this.shortcut = ''
      this.reload()
    },
    bannerTap(item) {
      navigate(item.link)
    }
  }
}
</script>
<style scoped>
.retry-more {
  background: transparent;
  color: var(--primary);
  font-size: var(--font-small);
  line-height: 88rpx;
}
.metadata-error {
  padding: 16rpx;
  margin-bottom: 24rpx;
  border-radius: 16rpx;
  background: #fff1e5;
  color: #a45c17;
  font-size: var(--font-small);
}
.search-panel {
  background: #fff;
  padding: 12rpx 32rpx 0;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 22rpx;
}
.city {
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 6rpx;
  min-height: 80rpx;
  font-size: var(--font-body);
}
.city text {
  max-width: 110rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.search-input {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 12rpx;
  background: #f2f4f7;
  border-radius: 44rpx;
  height: 44px;
  padding: 0 22rpx;
}
.search-input input {
  flex: 1;
  min-width: 0;
  font-size: var(--font-body);
}
.clear {
  background: transparent;
  margin: 0;
  padding: 0;
  line-height: 44px;
  min-width: 36px;
  min-height: 44px;
}
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0 4rpx;
  gap: 10rpx;
}
.filter {
  display: flex;
  align-items: center;
  gap: 8rpx;
  height: 88rpx;
  min-height: 44px;
  font-size: var(--font-body);
  color: #566171;
  white-space: nowrap;
}
.filter.active,
.filter-reset {
  color: var(--primary);
}
.filter-reset {
  padding: 0;
  margin: 0;
  background: transparent;
  line-height: 88rpx;
}
.banner-wrapper {
  border-radius: 24rpx;
  overflow: hidden;
}
.banner {
  height: 270rpx;
  min-height: 0;
}
.banner-image {
  width: 100%;
  height: 100%;
}
.banner-fallback {
  height: 100%;
  background: #2563eb;
  color: #fff;
  padding: 40rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.banner-fallback text {
  max-width: 65%;
  font-size: 21px;
  font-weight: 650;
  line-height: 1.5;
}
.quick-grid {
  display: flex;
  justify-content: space-around;
  gap: 8rpx;
  padding: 20rpx 0 32rpx;
}
.quick-item {
  background: transparent;
  color: var(--text);
  display: flex;
  flex: 1;
  align-items: center;
  flex-direction: column;
  padding: 8rpx 0;
  font-size: var(--font-small);
  line-height: 1.5;
  margin: 0;
}
.quick-icon {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
  transition:
    transform 160ms var(--ease-out),
    box-shadow 160ms ease;
}
.quick-pressed .quick-icon {
  transform: scale(0.92);
}
@media (prefers-reduced-motion: reduce) {
  .quick-icon {
    transition: none;
  }
  .quick-pressed .quick-icon {
    transform: none;
  }
}
.home :deep(.auth-gate) {
  margin: 16rpx 0 0;
}
.chosen .quick-icon {
  box-shadow:
    0 0 0 4rpx #fff,
    0 0 0 7rpx #2563eb;
}
.chosen text {
  color: var(--primary);
}
.result-label {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
  font-size: var(--font-caption);
  color: var(--muted);
  padding-bottom: 24rpx;
}
</style>
