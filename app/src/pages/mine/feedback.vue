<template>
  <view class="feedback-container">
    <!-- 自定义导航栏 -->
    <cu-custom bgColor="bg-white" isBack>
      <template #content>意见反馈</template>
    </cu-custom>
    
    <!-- 标签页 -->
    <view class="tabs">
      <view class="tab" 
        :class="{ active: activeTab === 'feedback' }"
        @click="activeTab = 'feedback'">
        意见反馈
      </view>
      <view class="tab" 
        :class="{ active: activeTab === 'record' }"
        @click="activeTab = 'record'">
        反馈记录
      </view>
    </view>
    
    <!-- 反馈内容 -->
    <view class="feedback-form" v-if="activeTab === 'feedback'">
      <view class="form-item">
        <text class="required">*</text>
        <text class="label">反馈内容</text>
      </view>
      <view class="input-area">
        <textarea aria-label="反馈内容" placeholder="请输入..." v-model="content"></textarea>
      </view>
      
      <!-- 图片上传 -->
      <view class="upload-area">
        <button class="upload-box" aria-label="添加反馈图片" @click="chooseImage">
          <uni-icons type="camera" size="30" color="#929baa" />
        </button>
        <view class="upload-preview" v-for="(item, index) in images" :key="index">
          <image :src="item" mode="aspectFill"></image>
          <view class="delete-btn" @click="deleteImage(index)">×</view>
        </view>
      </view>
      
      <!-- 提交按钮 -->
      <button role="button" class="submit-btn" @click="submitFeedback">立即提交</button>
    </view>
    
    <!-- 反馈记录 -->
    <view class="feedback-records" v-if="activeTab === 'record'">
      <view class="empty-tip" v-if="records.length === 0">
        <image src="/static/img/icons/empty.png" mode="aspectFit"></image>
        <text>暂无反馈记录</text>
      </view>
      <view class="record-item" v-for="(item, index) in records" :key="index">
        <view class="record-time">{{item.time}}</view>
        <view class="record-content">{{item.content}}</view>
        <view class="record-status" :class="item.status">{{item.statusText}}</view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/api/index.js'

export default {
  data() {
    return {
      activeTab: 'feedback',
      content: '',
      images: [],
      records: []
    }
  },
  onShow() {
    this.loadRecords()
  },
  methods: {
    chooseImage() {
      if (this.images.length >= 9) {
        uni.showToast({
          title: '最多上传9张图片',
          icon: 'none'
        })
        return
      }
      
      uni.chooseImage({
        count: 9 - this.images.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.images = [...this.images, ...res.tempFilePaths]
        }
      })
    },
    deleteImage(index) {
      this.images.splice(index, 1)
    },
    async submitFeedback() {
      if (!this.content.trim()) {
        uni.showToast({ title: '请输入反馈内容', icon: 'none' })
        return
      }
      uni.showLoading({ title: '提交中...' })
      try {
        const images = []
        for (const p of this.images) {
          let fileID = ''
          for (let attempt = 0; attempt < 2 && !fileID; attempt++) {
            try {
              fileID = await api.uploadFile(p, 'feedback')
            } catch (e) {
              if (attempt === 1) throw e
            }
          }
          images.push(fileID)
        }
        await api.submitFeedback({ content: this.content, type: 1, images })
        uni.hideLoading()
        uni.showToast({ title: '提交成功', icon: 'success' })
        this.content = ''
        this.images = []
        this.activeTab = 'record'
        this.loadRecords()
      } catch (e) {
        uni.hideLoading()
      }
    },
    async loadRecords() {
      try {
        const res = await api.getMyFeedback()
        this.records = (res.data.records || []).map((r) => ({
          id: r.id,
          time: this.formatTime(r.createdAt),
          content: r.content,
          status: r.status === 0 ? 'pending' : 'processed',
          statusText: r.status === 0 ? '处理中' : '已处理'
        }))
      } catch (e) {
        this.records = []
      }
    },
    formatTime(ts) {
      const d = new Date(ts)
      const p = (n) => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
    }
  }
}
</script>

<style lang="scss">
.feedback-container {
  min-height: 100vh;
  background-color: var(--canvas);
  
  .tabs {
    display: flex;
    background-color: #fff;
    border-bottom: 1px solid #eee;
    
    .tab {
      flex: 1;
      text-align: center;
      padding: 30rpx 0;
      font-size: var(--font-body);
      color: var(--muted);
      position: relative;
      
      &.active {
        color: #3D7EFF;
        font-weight: bold;
        
        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 25%;
          width: 50%;
          height: 4rpx;
          background-color: #3D7EFF;
        }
      }
    }
  }
  
  .feedback-form {
    padding: 30rpx;
    
    .form-item {
      margin-bottom: 20rpx;
      display: flex;
      align-items: center;
      
      .required {
        color: #f44336;
        margin-right: 10rpx;
        font-size: var(--font-body);
      }
      
      .label {
        font-size: var(--font-body);
        color: var(--text);
      }
    }
    
    .input-area {
      background-color: #fff;
      border-radius: 8rpx;
      padding: 20rpx;
      margin-bottom: 30rpx;
      
      textarea {
        width: 100%;
        height: 200rpx;
        font-size: var(--font-body);
      }
    }
    
    .upload-area {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 50rpx;
      
      .upload-box, .upload-preview {
        width: 150rpx;
        height: 150rpx;
        margin-right: 20rpx;
        margin-bottom: 20rpx;
        border: 1px dashed #ddd;
        border-radius: 8rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .upload-box {
        margin-left: 0;
        padding: 0;
        line-height: 1;
        background: transparent;

        &::after {
          border: none;
        }
      }
      
      .upload-preview {
        border: none;
        
        image {
          width: 100%;
          height: 100%;
          border-radius: 8rpx;
        }
        
        .delete-btn {
          position: absolute;
          top: -20rpx;
          right: -20rpx;
          width: 40rpx;
          height: 40rpx;
          background-color: rgba(0, 0, 0, 0.5);
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--font-control);
        }
      }
    }
    
    .submit-btn {
      background-color: #3D7EFF;
      color: #fff;
      font-size: var(--font-control);
      height: 90rpx;
      line-height: 90rpx;
      border-radius: 45rpx;
    }
  }
  
  .feedback-records {
    padding: 30rpx;
    
    .empty-tip {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 100rpx 0;
      
      image {
        width: 200rpx;
        height: 200rpx;
        margin-bottom: 30rpx;
      }
      
      text {
        font-size: var(--font-body);
        color: var(--muted);
      }
    }
    
    .record-item {
      background-color: #fff;
      border-radius: 8rpx;
      padding: 30rpx;
      margin-bottom: 20rpx;
      
      .record-time {
        font-size: var(--font-caption);
        color: var(--muted);
        margin-bottom: 20rpx;
      }
      
      .record-content {
        font-size: var(--font-body);
        color: var(--text);
        line-height: 1.5;
        margin-bottom: 20rpx;
      }
      
      .record-status {
        font-size: var(--font-caption);
        
        &.pending {
          color: #FF9800;
        }
        
        &.processed {
          color: var(--primary);
        }
      }
    }
  }
}
</style>
