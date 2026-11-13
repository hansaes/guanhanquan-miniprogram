<template>
  <view class="ui-page search-page">
    <cu-custom isBack><template #content>找活</template></cu-custom>
    <view class="search-controls">
      <view class="search-row">
        <view class="search-input">
          <uni-icons type="search" size="20" color="#929ba9" />
          <input
            aria-label="搜索关键词"
            v-model="keyword"
            :placeholder="content.searchPlaceholder || '搜索工种、地区'"
            confirm-type="search"
            @confirm="reload"
          />
          <button
            role="button"
            v-if="keyword"
            class="clear-search"
            aria-label="清空搜索"
            @tap="clearKeyword"
          >
            <uni-icons type="clear" size="18" color="#929ba9" />
          </button>
        </view>
        <button class="search-submit" role="button" @tap="reload">搜索</button>
      </view>
      <view class="filters">
        <option-picker
          title="选择工种"
          :options="categoryNames"
          :value="categoryIndex"
          @change="onCategoryChange"
        >
          <view class="filter" :class="{ active: categoryId }">
            <text>{{ categoryName || '工种' }}</text>
            <uni-icons type="bottom" size="11" />
          </view>
        </option-picker>
        <region-picker :value="region" allow-all @change="onRegionChange">
          <view class="filter" :class="{ active: city }">
            <text>{{ city || '地区' }}</text>
            <uni-icons type="bottom" size="11" />
          </view>
        </region-picker>
        <option-picker
          title="日薪范围"
          :options="salaryLabels"
          :value="salaryIndex"
          @change="onSalaryChange"
        >
          <view class="filter" :class="{ active: salaryIndex }">
            <text>薪资</text>
            <uni-icons type="bottom" size="11" />
          </view>
        </option-picker>
        <option-picker
          title="发布时间"
          :options="timeOptions"
          :value="timeIndex"
          @change="onTimeChange"
        >
          <view class="filter" :class="{ active: within }">
            <text>时间</text>
            <uni-icons type="bottom" size="11" />
          </view>
        </option-picker>
      </view>
      <view class="sorts" role="radiogroup" aria-label="岗位排序">
        <button
          v-for="item in sorts"
          :key="item.value"
          class="sort"
          :class="{ active: sort === item.value }"
          role="radio"
          :aria-checked="sort === item.value"
          @tap="setSort(item.value)"
        >
          {{ item.label }}
        </button>
      </view>
    </view>
    <view class="ui-body">
      <button role="button" v-if="metadataError" class="metadata-error" @tap="loadCategories">
        筛选选项加载失败 · 重试
      </button>
      <auth-gate title="登录后查看岗位" @ready="reload">
        <view class="results-heading">
          <text>{{ loading && !list.length ? '正在查找' : total + ' 个岗位' }}</text>
          <button role="button" v-if="hasFilter" class="reset-filter" @tap="resetFilters">
            重置筛选
          </button>
        </view>
        <page-state
          v-if="!list.length"
          :loading="loading"
          :error="error"
          empty-text="暂无匹配岗位，试试其他条件"
          @retry="reload"
        />
        <view v-else>
          <job-card v-for="job in list" :key="job.id" :job="job" />
          <button role="button" v-if="error" class="retry-more" @tap="loadMore">
            加载失败，点击重试
          </button>
          <view v-else class="ui-end">
            {{ loading ? '正在加载…' : hasMore ? '上拉加载更多' : '已经到底了' }}
          </view>
        </view>
      </auth-gate>
    </view>
  </view>
</template>
<script>
import api from '@/api/index.js'
import { content, loadContent, dictionary } from '@/utils/content'
import { session } from '@/utils/auth'

export default {
  data() {
    return {
      session,
      content,
      error: '',
      metadataError: false,
      sorts: [
        { value: '', label: '最新发布' },
        { value: 'salary', label: '薪资最高' },
        { value: 'views', label: '浏览最多' }
      ],
      requestId: 0,
      keyword: '',
      sort: '',
      within: '',
      categoryId: '',
      categoryName: '',
      categories: [],
      salaryIndex: 0,
      region: [],
      regionCode: '',
      city: '',
      list: [],
      page: 1,
      pageSize: 20,
      total: 0,
      loading: false,
      hasMore: true
    }
  },
  computed: {
    authenticated() {
      return this.session.authReady && !!this.session.userInfo?.id
    },
    timeIndex() {
      return Math.max(
        0,
        this.timeOptions.findIndex((item) => Number(item.value) === Number(this.within))
      )
    },
    hasFilter() {
      return !!(this.categoryId || this.regionCode || this.salaryIndex || this.within)
    },
    categoryIndex() {
      return this.categories.findIndex((item) => item.id === this.categoryId) + 1
    },
    salaryLabels() {
      return dictionary('salaryRanges').map((x) => x.label)
    },
    timeOptions() {
      return dictionary('timeRanges')
    },
    categoryNames() {
      return ['全部工种'].concat(this.categories.map((c) => c.name))
    }
  },
  watch: {
    authenticated(value) {
      if (!value) this.clearJobs()
    }
  },
  onLoad(options) {
    this.categoryId = options.id || ''
    this.loadCategories()
  },
  async onPullDownRefresh() {
    await this.reload()
    uni.stopPullDownRefresh()
  },
  onReachBottom() {
    this.loadMore()
  },
  methods: {
    clearJobs() {
      this.requestId++
      this.list = []
      this.total = 0
      this.page = 1
      this.hasMore = true
      this.loading = false
      this.error = ''
    },
    clearKeyword() {
      this.keyword = ''
      this.reload()
    },
    resetFilters() {
      this.categoryId = ''
      this.categoryName = ''
      this.region = []
      this.regionCode = ''
      this.city = ''
      this.salaryIndex = 0
      this.within = ''
      this.reload()
    },
    onTimeChange(event) {
      this.within = this.timeOptions[Number(event.detail.value)]?.value || ''
      this.reload()
    },
    async loadCategories() {
      this.metadataError = false
      try {
        const [res] = await Promise.all([api.getCategories(), loadContent()])
        this.categories = res.data || []
        this.categoryName = (this.categories.find((x) => x.id === this.categoryId) || {}).name || ''
      } catch (e) {
        this.metadataError = true
      }
    },
    onCategoryChange(e) {
      const i = Number(e.detail.value)
      if (i === 0) {
        this.categoryId = ''
        this.categoryName = ''
      } else {
        const c = this.categories[i - 1]
        this.categoryId = c ? c.id : ''
        this.categoryName = c ? c.name : ''
      }
      this.reload()
    },
    onRegionChange(e) {
      const picked = e.detail.value || []
      this.region = picked
      this.regionCode = e.detail.code
      this.city = String(picked[picked.length - 1] || '').replace(/[省市]$/g, '')
      this.reload()
    },
    onSalaryChange(e) {
      this.salaryIndex = Number(e.detail.value)
      this.reload()
    },
    setSort(v) {
      this.sort = v
      this.reload()
    },
    setWithin(v) {
      this.within = this.within === v ? '' : v
      this.reload()
    },
    params(page) {
      const range = dictionary('salaryRanges')[this.salaryIndex] || {}
      return {
        page,
        pageSize: this.pageSize,
        keyword: this.keyword || undefined,
        categoryId: this.categoryId || undefined,
        city: this.city || undefined,
        regionCode: this.regionCode || undefined,
        minSalary: range.min || undefined,
        maxSalary: range.max || undefined,
        sort: this.sort || undefined,
        createdWithin: this.within || undefined
      }
    },
    async reload() {
      this.page = 1
      this.hasMore = true
      await this.fetch(true)
    },
    async loadMore() {
      if (!this.hasMore || this.loading) return
      await this.fetch(false)
    },
    async fetch(reset) {
      if (!this.authenticated) return this.clearJobs()
      const requestId = ++this.requestId
      const nextPage = reset ? 1 : this.page + 1
      this.loading = true
      this.error = ''
      if (reset) this.list = []
      try {
        const res = await api.getJobList(this.params(nextPage))
        if (requestId !== this.requestId || !this.authenticated) return
        this.page = nextPage
        const data = res.data || {}
        const records = data.records || []
        this.total = data.total || 0
        this.list = reset ? records : this.list.concat(records)
        this.hasMore = this.list.length < this.total
      } catch (e) {
        if (requestId === this.requestId && this.authenticated) this.error = '岗位加载失败'
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    goDetail(job) {
      uni.navigateTo({ url: '/pages/jobDetail/jobDetail?id=' + job.id })
    }
  }
}
</script>

<style scoped>
.search-controls {
  background: #fff;
  padding: 12rpx 32rpx 0;
}
.search-row {
  display: flex;
  gap: 20rpx;
  align-items: center;
}
.search-input {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #f2f4f7;
  border-radius: 44rpx;
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 24rpx;
}
.search-input input {
  min-width: 0;
  flex: 1;
  font-size: var(--font-body);
}
.search-submit {
  margin: 0;
  padding: 0 8rpx;
  background: transparent;
  color: var(--primary);
  font-size: var(--font-body);
  min-height: 44px;
  line-height: 44px;
}
.clear-search {
  background: transparent;
  margin: 0;
  padding: 0;
  min-height: 44px;
  min-width: 36px;
  line-height: 44px;
}
.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16rpx;
}
.filter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-height: 44px;
  font-size: var(--font-body);
  color: #566171;
}
.filter text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.filter.active {
  color: var(--primary);
}
.sorts {
  display: flex;
  border-top: 1rpx solid var(--line);
  gap: 32rpx;
}
.sort {
  min-height: 44px;
  background: transparent;
  margin: 0;
  padding: 0 4rpx;
  font-size: var(--font-small);
  line-height: 44px;
  color: var(--muted);
  border-radius: 0;
  border-bottom: 4rpx solid transparent;
}
.sort.active {
  color: var(--ink);
  font-weight: 600;
  border-bottom-color: var(--primary);
}
.results-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64rpx;
  margin: -8rpx 0 16rpx;
  color: var(--muted);
  font-size: var(--font-caption);
}
.reset-filter,
.retry-more {
  background: transparent;
  color: var(--primary);
  font-size: var(--font-small);
}
.reset-filter {
  margin: 0;
  padding: 0;
  min-height: 44px;
  line-height: 44px;
}
.retry-more {
  width: 100%;
  line-height: 88rpx;
}
.metadata-error {
  padding: 12rpx;
  font-size: var(--font-small);
  color: #a45c17;
  background: #fff1e5;
  margin-bottom: 20rpx;
  border-radius: 12rpx;
}
</style>
