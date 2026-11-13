<template>
  <view class="certification-container">
    <!-- 自定义导航栏 -->
    <nav-bar title="企业认证" :showBack="true"></nav-bar>

    <!-- 认证表单 -->
    <page-state
      v-if="loading || loadError"
      :loading="loading"
      :error="loadError"
      @retry="loadProfile"
    />
    <view v-else class="form-container">
      <view v-if="status === 0" class="status-banner">资料已提交，等待平台审核</view>
      <view v-else-if="status === 2" class="status-banner danger">
        审核未通过：{{ rejectReason || '资料不完整' }}
      </view>
      <view v-else-if="status === 1" class="status-banner success">企业认证已通过</view>
      <view class="form-title">企业信息</view>

      <!-- 企业名称 -->
      <view class="form-item">
        <view class="label">
          <text class="required">*</text>
          <text>企业名称</text>
        </view>
        <input
          aria-label="企业名称"
          type="text"
          placeholder="请输入企业全称"
          v-model="formData.companyName"
        />
      </view>

      <!-- 统一社会信用代码 -->
      <view class="form-item">
        <view class="label">
          <text class="required">*</text>
          <text>统一社会信用代码</text>
        </view>
        <input
          aria-label="统一社会信用代码"
          type="text"
          placeholder="请输入统一社会信用代码"
          v-model="formData.creditCode"
          maxlength="18"
        />
      </view>

      <!-- 企业法人 -->
      <view class="form-item">
        <view class="label">
          <text class="required">*</text>
          <text>企业法人</text>
        </view>
        <input
          aria-label="企业法人"
          type="text"
          placeholder="请输入法人姓名"
          v-model="formData.legalPerson"
        />
      </view>

      <!-- 联系电话 -->
      <view class="form-item">
        <view class="label">
          <text class="required">*</text>
          <text>联系电话</text>
        </view>
        <input
          aria-label="联系电话"
          type="number"
          placeholder="请输入联系电话"
          v-model="formData.contactPhone"
          maxlength="11"
        />
      </view>

      <!-- 所在地区 -->
      <view class="form-item">
        <view class="label">
          <text class="required">*</text>
          <text>所在地区</text>
        </view>
        <region-picker :value="regionValue" :address="formData.region" @change="onRegionChange">
          <view class="picker-item">
            <text class="picker-text">{{ formData.region || '请选择地区' }}</text>
            <uni-icons type="arrowright" size="16" color="#CCCCCC"></uni-icons>
          </view>
        </region-picker>
      </view>

      <!-- 详细地址 -->
      <view class="form-item">
        <view class="label">
          <text class="required">*</text>
          <text>详细地址</text>
        </view>
        <input
          aria-label="详细地址"
          type="text"
          placeholder="请输入详细地址"
          v-model="formData.address"
        />
      </view>

      <!-- 企业规模 -->
      <view class="form-item">
        <view class="label">
          <text>企业规模</text>
        </view>
        <option-picker
          title="企业规模"
          :options="scaleOptions"
          :value="dictionary('companyScales').findIndex((x) => x.value === formData.scale)"
          @change="onScaleChange"
        >
          <view class="picker-item">
            <text class="picker-text">
              {{ labelFor('companyScales', formData.scale, formData.scale) || '请选择企业规模' }}
            </text>
            <uni-icons type="arrowright" size="16" color="#98a2b1" />
          </view>
        </option-picker>
      </view>

      <!-- 企业简介 -->
      <view class="form-item textarea-item">
        <view class="label">
          <text>企业简介</text>
        </view>
        <textarea
          aria-label="企业简介"
          placeholder="请输入企业简介"
          v-model="formData.description"
          maxlength="200"
        />
        <view class="word-count">{{ formData.description.length }}/200</view>
      </view>

      <view class="form-title">资质证明</view>

      <!-- 营业执照 -->
      <view class="form-item">
        <view class="label">
          <text class="required">*</text>
          <text>营业执照</text>
        </view>
        <view class="upload-area">
          <view class="upload-box" @click="chooseImage('license')" v-if="!formData.license">
            <view class="upload-icon">+</view>
            <text>上传营业执照</text>
          </view>
          <view class="image-preview" v-else>
            <image :src="formData.license" mode="aspectFill"></image>
            <view class="delete-btn" @click.stop="deleteImage('license')">×</view>
          </view>
        </view>
      </view>

      <!-- 企业Logo -->
      <view class="form-item">
        <view class="label">
          <text>企业Logo</text>
        </view>
        <view class="upload-area">
          <view class="upload-box" @click="chooseImage('logo')" v-if="!formData.logo">
            <view class="upload-icon">+</view>
            <text>上传Logo</text>
          </view>
          <view class="image-preview" v-else>
            <image :src="formData.logo" mode="aspectFill"></image>
            <view class="delete-btn" @click.stop="deleteImage('logo')">×</view>
          </view>
        </view>
      </view>

      <!-- 提交按钮 -->
      <button role="button"
        class="submit-btn"
        :loading="submitting"
        :disabled="submitting || uploading"
        @click="submitForm"
      >
        {{ status === 1 ? '提交更新并重新审核' : '提交认证' }}
      </button>

      <view class="tips">提交的企业资料将由平台审核。</view>
    </view>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { content, loadContent, dictionary, labelFor } from '@/utils/content'
export default {
  data() {
    return {
      formData: {
        companyName: '',
        creditCode: '',
        legalPerson: '',
        contactPhone: '',
        region: '',
        address: '',
        scale: '',
        description: '',
        license: '',
        logo: ''
      },
      content,
      regionValue: [],
      status: -1,
      loading: true,
      loadError: '',
      submitting: false,
      uploading: false,
      rejectReason: ''
    }
  },
  onLoad() {
    this.loadProfile()
  },
  computed: {
    scaleOptions() {
      return dictionary('companyScales').map((x) => x.label)
    }
  },
  methods: {
    dictionary,
    labelFor,
    async loadProfile() {
      this.loading = true
      this.loadError = ''
      try {
        const [res] = await Promise.all([api.getEmployerProfile(), loadContent()])
        const d = res.data || {}
        this.formData.companyName = d.companyName || ''
        this.formData.creditCode = d.creditCode || ''
        this.formData.license = d.license || ''
        this.formData.region = d.region || ''
        this.formData.address = d.addressDetail || (d.region ? '' : d.address) || ''
        this.formData.legalPerson = d.contactName || ''
        this.formData.scale = d.scale || ''
        this.formData.description = d.description || ''
        this.formData.logo = d.logo || ''
        this.formData.contactPhone = d.contactPhone || ''
        this.status = d.verified
          ? 1
          : d.enterpriseStatus === 0
            ? 0
            : d.enterpriseStatus === 2
              ? 2
              : -1
        this.rejectReason = d.rejectReason || ''
      } catch (e) {
        this.loadError = '企业资料加载失败'
      } finally {
        this.loading = false
      }
    },
    onRegionChange(e) {
      const picked = e.detail.value || []
      this.regionValue = picked
      this.formData.region = picked.join(' ')
    },

    // 打开企业规模选择器
    onScaleChange(event) {
      const option = dictionary('companyScales')[Number(event.detail.value)]
      if (option) this.formData.scale = option.value
    },

    // 选择图片
    chooseImage(type) {
      if (this.uploading) return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const path = res.tempFilePaths[0]
          this.uploading = true
          try {
            uni.showLoading({ title: '上传中' })
            const fileID = await api.uploadFile(path, 'license')
            this.formData[type] = fileID
          } catch (e) {
            uni.showToast({ title: '上传失败', icon: 'none' })
          } finally {
            this.uploading = false
            uni.hideLoading()
          }
        }
      })
    },

    // 删除图片
    deleteImage(type) {
      this.formData[type] = ''
    },

    // 提交表单
    async submitForm() {
      if (this.submitting || this.uploading) return
      // 表单验证
      if (!this.formData.companyName) {
        return this.showError('请输入企业名称')
      }
      if (!this.formData.creditCode) {
        return this.showError('请输入统一社会信用代码')
      }
      if (!this.formData.legalPerson) {
        return this.showError('请输入企业法人')
      }
      if (!/^1\d{10}$/.test(this.formData.contactPhone)) {
        return this.showError('请输入正确的联系电话')
      }
      if (!this.formData.region) {
        return this.showError('请选择所在地区')
      }
      if (!this.formData.address) {
        return this.showError('请输入详细地址')
      }
      if (!this.formData.license) {
        return this.showError('请上传营业执照')
      }

      this.submitting = true
      try {
        await api.updateEmployerProfile({
          companyName: this.formData.companyName,
          creditCode: this.formData.creditCode,
          license: this.formData.license,
          address: (this.formData.region || '') + (this.formData.address || ''),
          contactName: this.formData.legalPerson,
          contactPhone: this.formData.contactPhone,
          region: this.formData.region,
          addressDetail: this.formData.address,
          scale: this.formData.scale,
          description: this.formData.description,
          logo: this.formData.logo
        })
        this.status = 0
        uni.showToast({ title: '已提交审核', icon: 'success' })
      } catch (e) {
      } finally {
        this.submitting = false
      }
    },

    // 显示错误提示
    showError(message) {
      uni.showToast({
        title: message,
        icon: 'none'
      })
      return false
    }
  }
}
</script>

<style lang="scss">
.status-banner {
  margin: 20rpx 30rpx 0;
  padding: 18rpx 24rpx;
  border-radius: 10rpx;
  background: #fff7e6;
  color: #fa8c16;
  font-size: var(--font-caption);
}
.status-banner.danger {
  background: #fff1f0;
  color: #e54d42;
}
.status-banner.success {
  background: #f6ffed;
  color: #52c41a;
}
.certification-container {
  min-height: 100vh;
  background-color: var(--canvas);

  .form-container {
    padding: 30rpx;

    .form-title {
      font-size: 16px;
      font-weight: bold;
      color: var(--text);
      margin: 30rpx 0 20rpx;
      position: relative;
      padding-left: 20rpx;

      &:before {
        content: '';
        position: absolute;
        left: 0;
        top: 10rpx;
        width: 6rpx;
        height: 30rpx;
        background-color: var(--primary);
        border-radius: 3rpx;
      }
    }

    .form-item {
      background-color: #ffffff;
      padding: 24rpx 30rpx;
      margin-bottom: 2rpx;

      .label {
        display: flex;
        margin-bottom: 20rpx;

        .required {
          color: #ff5722;
          margin-right: 5rpx;
        }

        text {
          font-size: var(--font-body);
          color: var(--text);
        }
      }

      input,
      .picker-item {
        height: 80rpx;
        font-size: var(--font-body);
        color: var(--text);
      }

      .picker-item {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .picker-text {
          color: var(--muted);
        }
      }

      &.textarea-item {
        position: relative;
        padding-bottom: 50rpx;

        textarea {
          width: 100%;
          height: 200rpx;
          font-size: var(--font-body);
          color: var(--text);
        }

        .word-count {
          position: absolute;
          right: 30rpx;
          bottom: 20rpx;
          font-size: var(--font-caption);
          color: var(--muted);
        }
      }

      .upload-area {
        display: flex;

        .upload-box,
        .image-preview {
          width: 200rpx;
          height: 200rpx;
          border: 1px dashed #dddddd;
          border-radius: 8rpx;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          .upload-icon {
            font-size: 50rpx;
            color: #cccccc;
            margin-bottom: 10rpx;
          }

          text {
            font-size: var(--font-caption);
            color: var(--muted);
          }
        }

        .image-preview {
          position: relative;
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
            color: #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
      }
    }

    .submit-btn {
      background-color: var(--primary);
      color: #ffffff;
      font-size: 16px;
      height: 90rpx;
      line-height: 90rpx;
      border-radius: 45rpx;
      margin: 60rpx 0 40rpx;
    }

    .tips {
      padding: 0 24rpx 32rpx;
      font-size: var(--font-caption);
      color: var(--muted);
      line-height: 1.6;

      .tips-title {
        font-size: var(--font-body);
        color: var(--muted);
        margin-bottom: 20rpx;
      }

      .tips-item {
        font-size: var(--font-small);
        color: var(--muted);
        line-height: 1.8;
      }
    }
  }
}
</style>
