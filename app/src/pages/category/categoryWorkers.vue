<template>
  <view class="category-workers-container">
    <!-- 自定义导航栏 -->
    <nav-bar :title="categoryName" :showBack="true"></nav-bar>
    
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input">
        <image class="search-icon" src="/static/img/icons/search.png" mode="aspectFit"></image>
        <input aria-label="搜索关键词" type="text" :placeholder="`搜索${categoryName}相关工人`" confirm-type="search" v-model="keyword" @confirm="search" />
      </view>
      <button role="button" class="search-btn" @click="search">搜索</button>
    </view>
    
    <!-- 工人列表 -->
    <scroll-view scroll-y class="worker-list" refresher-enabled @refresherrefresh="onRefresh" :refresher-triggered="isRefreshing">
      <view class="worker-item" v-for="(worker, index) in workerList" :key="index" @click="viewWorkerDetail(worker)">
        <view class="worker-info">
          <view class="name-tag">
            <text class="name">{{ worker.name }}</text>
            <text v-if="worker.certificateInfo" class="cert-tag">{{ worker.certificateInfo }}</text>
          </view>
        </view>
        <view class="basic-info">
          <text>{{ worker.workExperience || '年限未填' }} · {{ (worker.jobTypes || []).join(' / ') || '工种未填' }}</text>
        </view>
        <view class="detail-info">
          <view class="info-item"><text>期望地区：{{ worker.expectArea || '不限' }}</text></view>
          <view class="info-item"><text>期望薪资：{{ worker.expectSalary || '面议' }}</text></view>
        </view>
        <view class="update-time">{{ fmt(worker.updatedAt) }}</view>
        <view class="action-buttons">
          <button role="button" class="action-btn call-btn" @click.stop="viewWorkerDetail(worker)">查看简历</button>
        </view>
      </view>
      
      <view class="empty-state" v-if="workerList.length === 0">
        <image src="/static/img/icons/empty.png" mode="aspectFit"></image>
        <text>暂无{{ categoryName }}相关工人</text>
      </view>
    </scroll-view>
    
  </view>
</template>

<script>
import API from '@/api/index.js'

export default {
  data() {
    return {
      categoryId: null,
      categoryName: '',
      keyword: '',
      isRefreshing: false,
      workerList: []
    }
  },
  onLoad(options) {
    if (options.id) {
      this.categoryId = options.id
    }
    if (options.name) {
      this.categoryName = decodeURIComponent(options.name)
    }
    this.loadWorkerList()
  },
  methods: {
    fmt(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return (d.getMonth() + 1) + '-' + d.getDate() + ' 更新'
    },
    async loadWorkerList() {
      this.loading = true
      try {
        const params = { page: 1, pageSize: 20, keyword: this.keyword || undefined }
        const res = this.categoryId
          ? await API.getWorkersByCategory(this.categoryId, params)
          : await API.getWorkerList(params)
        this.workerList = (res.data && res.data.records) || []
      } catch (e) {
        this.workerList = []
      } finally {
        uni.hideLoading()
        this.loading = false
      }
    },

    search() {
      // 搜索处理
      this.loadWorkerList()
    },
    onRefresh() {
      this.isRefreshing = true
      
      // 刷新数据
      setTimeout(() => {
        this.loadWorkerList()
        this.isRefreshing = false
      }, 1000)
    },
    viewWorkerDetail(worker) {
      uni.navigateTo({
        url: `/pages/worker/workerDetail?id=${worker.id}`
      })
    },
  }
}
</script>

<style lang="scss">
.category-workers-container {
  min-height: 100vh;
  background-color: var(--canvas);
  padding-bottom: 30rpx;
  
  .search-bar {
    display: flex;
    align-items: center;
    padding: 20rpx;
    background-color: #FFFFFF;
    
    .search-input {
      flex: 1;
      height: 70rpx;
      background: var(--canvas);
      border-radius: 35rpx;
      display: flex;
      align-items: center;
      padding: 0 20rpx;
      margin-right: 16rpx;
      
      .search-icon {
        width: 32rpx;
        height: 32rpx;
        margin-right: 10rpx;
      }
      
      input {
        flex: 1;
        height: 70rpx;
        font-size: var(--font-small);
      }
    }
    
    .search-btn {
      width: 100rpx;
      height: 70rpx;
      line-height: 70rpx;
      text-align: center;
      background: var(--primary);
      border-radius: 35rpx;
      color: #FFF;
      font-size: var(--font-small);
      padding: 0;
    }
  }
  
  .filter-section {
    display: flex;
    justify-content: space-between;
    background-color: #FFFFFF;
    padding: 20rpx 30rpx;
    margin: 0 20rpx;
    margin-bottom: 20rpx;
    border-radius: 24rpx;
    box-shadow: 0 4rpx 16rpx 0 rgba(0, 0, 0, 0.08);
    
    .filter-item {
      display: flex;
      align-items: center;
      font-size: var(--font-caption);
      color: var(--muted);
    }
  }
  
  .worker-list {
    padding: 0 20rpx;
    height: calc(100vh - 240rpx);
    
    .worker-item {
      background-color: #FFFFFF;
      padding: 24rpx;
      margin-bottom: 20rpx;
      border-radius: 24rpx;
      box-shadow: 0 4rpx 16rpx 0 rgba(0, 0, 0, 0.08);
      
      .worker-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16rpx;
        
        .cert-tag { font-size: var(--font-caption); color: #52c41a; border: 1rpx solid #52c41a; border-radius: 4rpx; padding: 0 6rpx; margin-left: 8rpx; }
  .name-tag {
          display: flex;
          align-items: center;
          
          .name {
            font-size: 16px;
            font-weight: bold;
            color: var(--text);
            margin-right: 10rpx;
          }
          
          .certified-icon {
            width: 32rpx;
            height: 32rpx;
          }
        }
        
        .badge {
          display: flex;
          align-items: center;
          background-color: rgba(76, 175, 80, 0.1);
          padding: 4rpx 12rpx;
          border-radius: 20rpx;
          
          .dot {
            width: 16rpx;
            height: 16rpx;
            border-radius: 50%;
            background-color: var(--primary);
            margin-right: 6rpx;
          }
          
          text {
            font-size: var(--font-caption);
            color: var(--primary);
          }
        }
      }
      
      .basic-info {
        font-size: var(--font-small);
        color: var(--muted);
        margin-bottom: 16rpx;
      }
      
      .detail-info {
        margin-bottom: 16rpx;
        
        .info-item {
          display: flex;
          align-items: center;
          margin-bottom: 10rpx;
          
          image {
            width: 28rpx;
            height: 28rpx;
            margin-right: 8rpx;
          }
          
          text {
            font-size: var(--font-small);
            color: var(--muted);
          }
        }
      }
      
      .update-time {
        text-align: right;
        font-size: var(--font-caption);
        color: var(--muted);
        margin-bottom: 16rpx;
      }
      
      .action-buttons {
        display: flex;
        justify-content: space-between;
        
        .action-btn {
          width: 48%;
          height: 70rpx;
          line-height: 70rpx;
          border-radius: 35rpx;
          font-size: var(--font-body);
          padding: 0;
        }
        
        .call-btn {
          background-color: var(--primary);
          color: #FFFFFF;
        }
        
        .message-btn {
          background-color: var(--canvas);
          color: var(--muted);
        }
      }
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 100rpx 0;
      
      image {
        width: 160rpx;
        height: 160rpx;
        margin-bottom: 20rpx;
      }
      
      text {
        font-size: var(--font-body);
        color: var(--muted);
      }
    }
  }
  
  .filter-popup {
    background-color: #FFFFFF;
    border-radius: 20rpx 20rpx 0 0;
    padding: 30rpx;
    
    .filter-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30rpx;
      
      text {
        font-size: 16px;
        color: var(--text);
        font-weight: bold;
      }
      
      .close-btn {
        font-size: var(--font-body);
        color: var(--muted);
      }
    }
    
    .filter-content {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 30rpx;
      
      .filter-option {
        width: 30%;
        height: 70rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--canvas);
        border-radius: 35rpx;
        margin-right: 3%;
        margin-bottom: 20rpx;
        
        text {
          font-size: var(--font-small);
          color: var(--muted);
        }
        
        &.active {
          background-color: #E8F5E9;
          border: 1rpx solid var(--primary);
          
          text {
            color: var(--primary);
          }
        }
      }
    }
    
    .filter-actions {
      display: flex;
      justify-content: space-between;
      
      button {
        width: 48%;
        height: 80rpx;
        line-height: 80rpx;
        border-radius: 40rpx;
        font-size: var(--font-body);
      }
      
      .reset-btn {
        background-color: var(--canvas);
        color: var(--muted);
      }
      
      .confirm-btn {
        background-color: var(--primary);
        color: #FFFFFF;
      }
    }
  }
}
</style>
