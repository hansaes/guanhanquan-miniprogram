<template>
  <view class="page">
    <cu-custom bgColor="bg-white" isBack><template #content>设置</template></cu-custom>
    <auth-gate title="登录后管理账号设置">
      <view class="group">
        <button role="button" class="item item-btn" @tap="editProfile">
          <text>头像与昵称</text><text class="arrow">›</text>
        </button>
        <button role="button" class="item item-btn" open-type="getPhoneNumber" @getphonenumber="bindPhone">
          <text>修改手机号</text><text class="arrow">›</text>
        </button>
        <view class="item">
          <text>在简历中展示手机号</text>
          <switch :checked="showPhone" color="#2563eb" @change="toggleShowPhone" />
        </view>
        <view class="item" @tap="openDoc('privacy-policy')">
          <text>隐私政策</text><text class="arrow">›</text>
        </view>
        <view class="item" @tap="openDoc('user-agreement')">
          <text>用户协议</text><text class="arrow">›</text>
        </view>
        <view class="item" @tap="clearCache">
          <text>清除缓存</text><text class="arrow">›</text>
        </view>
        <view class="item" @tap="about"> <text>关于我们</text><text class="arrow">›</text> </view>
      </view>

      <button role="button" class="logout" @tap="logout">退出登录</button>
      <button role="button" class="danger" @tap="deleteAccount">注销账号</button>
      <view class="version">管焊圈 v1.0.0</view>
    </auth-gate>
  </view>
</template>

<script>
import api from '@/api/index.js'
import { clearAuth, getUser, setUser } from '@/utils/auth'

export default {
  data() {
    return { showPhone: true }
  },
  onShow() {
    const u = getUser() || {}
    this.showPhone = u.showPhone !== false
  },
  methods: {
    editProfile() {
      uni.navigateTo({ url: '/pages/mine/profile' })
    },
    openDoc(name) {
      const map = {
        'privacy-policy': '/pages/common/privacy-policy',
        'user-agreement': '/pages/common/user-agreement'
      }
      uni.navigateTo({ url: map[name] })
    },
    async bindPhone(e) {
      const code = e.detail && e.detail.code
      if (!code) return uni.showToast({ title: '已取消授权', icon: 'none' })
      try {
        const res = await api.bindPhone(code)
        const u = Object.assign({}, getUser() || {}, { phone: res.data.phone })
        setUser(u)
        uni.showToast({ title: '已更新手机号', icon: 'success' })
      } catch (err) {}
    },
    async toggleShowPhone(e) {
      const value = !!e.detail.value
      this.showPhone = value
      try {
        const res = await api.updateUserProfile({ showPhone: value })
        setUser(res.data)
      } catch (err) {
        this.showPhone = !value
      }
    },
    clearCache() {
      uni.showModal({
        title: '清除缓存',
        content: '将清除本地缓存（不影响账号数据）',
        success: (r) => {
          if (!r.confirm) return
          const accountKeys = new Set(['token', 'ghq_user', 'userType', 'ghq_employer'])
          uni.getStorageInfoSync().keys.forEach((key) => {
            if (!accountKeys.has(key)) uni.removeStorageSync(key)
          })
          uni.showToast({ title: '已清除', icon: 'success' })
        }
      })
    },
    about() {
      uni.showModal({
        title: '关于管焊圈',
        content:
          '面向焊工、管工、铆工、起重工的招工找活平台。运营主体：沈阳市苏家屯区管焊圈互联网服务网店。',
        showCancel: false
      })
    },
    logout() {
      uni.showModal({
        title: '退出登录',
        content: '确认退出当前账号？',
        success: (r) => {
          if (!r.confirm) return
          clearAuth()
          this.$store.commit('setUserInfo', null)
          uni.reLaunch({ url: '/pages/index/index' })
        }
      })
    },
    deleteAccount() {
      uni.showModal({
        title: '注销账号',
        content: '注销后将无法登录，历史招工/报名记录保留用于审计。确认注销？',
        confirmText: '确认注销',
        confirmColor: '#e54d42',
        success: async (r) => {
          if (!r.confirm) return
          try {
            await api.deleteAccount()
            clearAuth()
            uni.reLaunch({ url: '/pages/index/index' })
          } catch (e) {}
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--canvas);
}
.group {
  background: #fff;
  margin-top: 20rpx;
}
.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  border-bottom: 1rpx solid var(--canvas);
  font-size: var(--font-control);
}
.item:last-child {
  border-bottom: none;
}
.item-btn {
  margin: 0;
  background: #fff;
  border-radius: 0;
  text-align: left;
  line-height: normal;
}
.item-btn::after {
  border: none;
}
.arrow {
  color: #ccc;
}
.logout {
  margin: 40rpx 24rpx 0;
  color: #e54d42;
  background: #fff;
  border-radius: 20rpx;
  height: 48px;
  line-height: 48px;
  font-size: var(--font-control);
}
.danger {
  margin: 24rpx 32rpx 0;
  color: var(--muted);
  background: transparent;
  font-size: var(--font-small);
}
.version {
  text-align: center;
  color: #bbb;
  font-size: var(--font-caption);
  margin-top: 30rpx;
}
</style>
