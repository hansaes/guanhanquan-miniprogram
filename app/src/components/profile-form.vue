<template>
  <form class="profile-form" @submit="save">
    <view class="avatar-field">
      <!-- #ifdef MP-WEIXIN -->
      <button role="button"
        class="avatar-button"
        open-type="chooseAvatar"
        :disabled="busy"
        aria-label="选择头像"
        @chooseavatar="chooseAvatar"
      >
        <image v-if="avatar" :src="avatar" mode="aspectFill" />
        <uni-icons v-else type="person-filled" size="46" color="#7c94bd" />
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <button role="button" class="avatar-button" :disabled="busy" aria-label="选择头像" @tap="chooseImage">
        <image v-if="avatar" :src="avatar" mode="aspectFill" />
        <uni-icons v-else type="person-filled" size="46" color="#7c94bd" />
      </button>
      <!-- #endif -->
      <text class="avatar-label">{{ uploading ? '上传中…' : '点击选择头像' }}</text>
    </view>
    <view class="nickname-field">
      <text class="field-label">昵称</text>
      <!-- #ifdef MP-WEIXIN -->
      <input
        name="nickname"
        type="nickname"
        :value="nickname"
        maxlength="20"
        placeholder="填写昵称"
        aria-label="昵称"
        :disabled="busy"
      />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <input
        name="nickname"
        :value="nickname"
        maxlength="20"
        placeholder="填写昵称"
        aria-label="昵称"
        :disabled="busy"
      />
      <!-- #endif -->
    </view>
    <text v-if="error" class="profile-error" role="alert">{{ error }}</text>
    <button role="button" form-type="submit" class="ui-button" :disabled="busy" :loading="saving">
      {{ submitText }}
    </button>
    <button role="button" v-if="optional" class="profile-skip" :disabled="busy" @tap="$emit('skip')">
      稍后完善
    </button>
  </form>
</template>
<script>
import api from '@/api'
import { setUser } from '@/utils/auth'
export default {
  props: {
    user: { type: Object, default: () => ({}) },
    optional: Boolean,
    submitText: { type: String, default: '保存资料' }
  },
  emits: ['saved', 'skip'],
  data() {
    return {
      nickname: this.user.nickname || '',
      avatar: this.user.avatar || '',
      uploading: false,
      saving: false,
      error: ''
    }
  },
  computed: {
    busy() {
      return this.uploading || this.saving
    }
  },
  methods: {
    chooseAvatar(event) {
      this.uploadAvatar(event.detail?.avatarUrl)
    },
    chooseImage() {
      if (this.busy) return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: (result) => this.uploadAvatar(result.tempFilePaths[0]),
        fail: (error) => {
          if (!/cancel/i.test(error.errMsg || '')) this.error = '图片选择失败，请重试'
        }
      })
    },
    async uploadAvatar(path) {
      if (!path || this.busy) return
      this.uploading = true
      this.error = ''
      try {
        this.avatar = await api.uploadFile(path, 'avatar')
      } catch {
        this.error = '头像上传失败，请重新选择'
      } finally {
        this.uploading = false
      }
    },
    async save(event) {
      if (this.busy) return
      // 使用原生 form 提交值，遵循微信昵称组件的安全检测结果。
      const nickname = String(event.detail?.value?.nickname || '').trim()
      this.nickname = nickname
      if (!nickname || nickname.length > 20) {
        this.error = '请填写 1–20 个字的昵称'
        return
      }
      this.saving = true
      this.error = ''
      try {
        const result = await api.updateUserProfile({ nickname, avatar: this.avatar })
        setUser(result.data)
        this.$emit('saved', result.data)
      } catch {
        this.error = '资料保存失败，请重试'
      } finally {
        this.saving = false
      }
    }
  }
}
</script>
<style scoped>
.avatar-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 16rpx 0 48rpx;
}
.avatar-button {
  width: 156rpx;
  height: 156rpx;
  padding: 0;
  border-radius: 50%;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.avatar-button::after {
  border: 0;
}
.avatar-button image {
  width: 100%;
  height: 100%;
}
.avatar-label {
  color: var(--muted);
  font-size: var(--font-small);
  margin-top: 20rpx;
}
.nickname-field {
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--line);
  display: flex;
  align-items: center;
  gap: 32rpx;
  margin-bottom: 40rpx;
}
.field-label {
  color: var(--ink);
  font-size: var(--font-control);
}
.nickname-field input {
  flex: 1;
  min-width: 0;
  height: 48px;
  font-size: var(--font-control);
}
.profile-error {
  display: block;
  margin-bottom: 24rpx;
  color: var(--danger);
  font-size: var(--font-small);
}
.profile-skip {
  background: transparent;
  color: var(--muted);
  font-size: var(--font-body);
  min-height: 44px;
  margin-top: 20rpx;
}
.profile-skip::after {
  border: 0;
}
</style>
