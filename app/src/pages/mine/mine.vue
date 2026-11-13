<template>
  <view class="ui-page ui-tab-page mine-container">
    <view v-if="isLoggedIn" class="profile-cover" :style="{ paddingTop: StatusBar + 36 + 'px' }">
      <button
        class="settings"
        :style="{ top: StatusBar + 12 + 'px' }"
        role="button"
        aria-label="设置"
        @tap="navigateTo('/pages/mine/settings')"
      >
        <uni-icons type="gear-filled" size="25" color="#fff" />
      </button>
      <view class="profile-row">
        <button
          class="profile-avatar"
          role="button"
          aria-label="编辑个人头像和昵称"
          @tap="navigateTo('/pages/mine/profile')"
        >
          <image v-if="localUser && localUser.avatar" :src="localUser.avatar" mode="aspectFill" />
          <uni-icons v-else type="person-filled" size="46" color="#fff" />
        </button>
        <view class="profile-info">
          <button class="profile-name" role="button" @tap="navigateTo('/pages/mine/profile')">
            {{ displayName }}
          </button>
          <view v-if="isLoggedIn" class="profile-badges">
            <text v-if="localUser?.id" class="id-badge">ID: {{ localUser.id.slice(-6) }}</text>
            <text v-if="certification" class="verified-badge">{{ certification }}</text>
          </view>
          <button role="button" v-else class="login" @tap="login">登录 / 注册</button>
        </view>
      </view>
    </view>
    <cu-custom v-else><template #content>我的</template></cu-custom>
    <auth-gate title="登录后管理个人信息" target="/pages/mine/mine" @ready="loadAccount">
      <view class="mine-body">
        <view class="wallet-card">
          <button class="wallet-item" role="button" @tap="checkLogin('/pages/wallet/index')">
            <text class="wallet-number">
              {{ isLoggedIn && walletReady && !walletError ? walletInfo.points : '—' }}
            </text>
            <text>我的积分</text>
          </button>
          <view class="wallet-divider" />
          <button class="wallet-item" role="button" @tap="checkLogin('/pages/wallet/index')">
            <text class="wallet-number">
              {{
                isLoggedIn && walletReady && !walletError
                  ? '¥ ' + Number(walletInfo.balance).toFixed(2)
                  : '—'
              }}
            </text>
            <text>钱包余额</text>
          </button>
          <button
            class="wallet-button"
            role="button"
            :disabled="walletLoading"
            @tap="walletError ? loadWallet() : checkLogin('/pages/wallet/index')"
          >
            {{ walletError ? '重试' : '充值' }}
          </button>
        </view>
        <view class="ui-card quick-services">
          <button
            role="button"
            hover-class="shortcut-pressed"
            :hover-start-time="0"
            :hover-stay-time="120"
            @tap="checkLogin('/pages/employer/jobManage')"
          >
            <view class="quick-icon tone-blue">
              <uni-icons type="staff-filled" size="26" color="#2563eb" />
            </view>
            <text>我的招工</text>
          </button>
          <button
            role="button"
            hover-class="shortcut-pressed"
            :hover-start-time="0"
            :hover-stay-time="120"
            @tap="checkLogin('/pages/resume/my')"
          >
            <view class="quick-icon tone-orange">
              <uni-icons type="contact-filled" size="26" color="#ed670d" />
            </view>
            <text>我的简历</text>
          </button>
          <button
            role="button"
            hover-class="shortcut-pressed"
            :hover-start-time="0"
            :hover-stay-time="120"
            @tap="checkLogin('/pages/mine/favorites')"
          >
            <view class="quick-icon favorite">
              <uni-icons type="heart-filled" size="26" color="#e74853" />
            </view>
            <text>我的收藏</text>
          </button>
        </view>
        <view class="ui-card services">
          <text class="menu-heading">常用服务</text>
          <button
            v-for="item in content.services"
            :key="item.value"
            class="service-row"
            role="button"
            :aria-label="item.label"
            hover-class="service-pressed"
            :hover-start-time="0"
            :hover-stay-time="120"
            @tap="checkLogin(item.path)"
          >
            <uni-icons :type="item.icon" size="23" :color="tones[item.tone]" />
            <text class="service-label">{{ item.label }}</text>
            <text v-if="item.value === 'realname' && certification" class="verified-status">
              已认证
            </text>
            <uni-icons type="right" size="16" color="#bdc4ce" />
          </button>
        </view>
        <view class="ui-card services">
          <button
            class="service-row"
            role="button"
            hover-class="service-pressed"
            @tap="navigateTo('/pages/mine/feedback')"
          >
            <uni-icons type="help-filled" size="23" color="#929baa" />
            <text class="service-label">意见反馈</text>
            <uni-icons type="right" size="16" color="#bdc4ce" />
          </button>
          <button
            class="service-row"
            role="button"
            hover-class="service-pressed"
            @tap="switchToEmployer"
          >
            <uni-icons type="staff" size="23" color="#929baa" />
            <text class="service-label">招工管理</text>
            <uni-icons type="right" size="16" color="#bdc4ce" />
          </button>
          <button
            class="service-row"
            role="button"
            hover-class="service-pressed"
            @tap="navigateTo('/pages/mine/settings')"
          >
            <uni-icons type="gear" size="23" color="#929baa" />
            <text class="service-label">设置</text>
            <uni-icons type="right" size="16" color="#bdc4ce" />
          </button>
        </view>
        <button v-if="isLoggedIn" class="logout-btn" role="button" @tap="handleLogout">
          退出当前登录
        </button>
      </view>
    </auth-gate>
    <app-tabbar :current="2" />
  </view>
</template>
<script>
import { mapState, mapMutations } from 'vuex'
import { content, loadContent } from '@/utils/content'
import { navigate } from '@/utils/navigation'
import api from '@/api/index.js'
import { getUser, setUser, clearAuth, session, goLogin } from '@/utils/auth'

export default {
  data() {
    return {
      content,
      session,
      walletError: false,
      walletReady: false,
      walletLoading: false,
      walletOwner: '',
      tones: { blue: '#2563eb', green: '#16a05a', orange: '#ed670d', purple: '#9250dc' },
      stats: { applicationCount: 0, favoriteCount: 0, certificationCount: 0 },
      localUser: null,
      wallet: { points: 0, balance: 0 }
    }
  },
  computed: {
    ...mapState(['userType', 'userInfo']),
    isLoggedIn() {
      return !!this.session.userInfo?.id
    },
    // 计算用户显示名称
    displayName() {
      return this.localUser ? this.localUser.nickname || '工友' : '未登录'
    },
    // 计算用户认证状态
    certification() {
      return this.localUser && this.localUser.realNameVerified ? '已实名' : ''
    },
    // 计算用户资产信息
    walletInfo() {
      return this.wallet
    },
    // 计算统计数据
    statsInfo() {
      return this.stats
    }
  },
  onShow() {
    uni.hideTabBar({ animation: false })
    loadContent().catch(() => {})
    if (this.localUser && session.authReady && session.userInfo) this.loadAccount()
  },
  methods: {
    loadAccount() {
      this.localUser = getUser()
      if (this.walletOwner !== this.localUser?.id) {
        this.walletOwner = this.localUser?.id || ''
        this.walletReady = false
      }
      this.refreshProfile()
      this.loadWallet()
    },
    async loadWallet() {
      if (!this.localUser || this.walletLoading) return
      this.walletLoading = true
      const owner = this.localUser.id
      try {
        const res = await api.getWallet()
        if (owner !== session.userInfo?.id) return
        const d = res.data || {}
        this.walletError = false
        this.wallet = { points: d.points || 0, balance: d.balance || 0 }
        this.walletReady = true
      } catch (e) {
        if (owner === session.userInfo?.id) this.walletError = true
      } finally {
        this.walletLoading = false
      }
    },
    async loadStats() {
      if (!this.isLoggedIn) return
      try {
        const [apps, favs] = await Promise.all([
          api.getWorkerApplications({ page: 1, pageSize: 1 }),
          api.getFavorites({ page: 1, pageSize: 1 })
        ])
        this.stats = {
          applicationCount: (apps.data && apps.data.total) || 0,
          favoriteCount: (favs.data && favs.data.total) || 0,
          certificationCount: this.userInfo && this.userInfo.realNameVerified ? 1 : 0
        }
      } catch (e) {}
    },
    ...mapMutations(['setUserInfo', 'setUserType']),
    async refreshProfile() {
      if (!this.localUser) return
      const owner = this.localUser.id
      try {
        const res = await api.getUserProfile()
        if (owner !== session.userInfo?.id) return
        this.localUser = res.data
        this.setUserInfo(res.data)
        setUser(res.data)
      } catch (e) {
        if (owner === session.userInfo?.id && e && e.code === 403) {
          clearAuth()
          this.localUser = null
        }
      }
    },
    // 检查登录状态并跳转
    checkLogin(url) {
      if (this.isLoggedIn) {
        this.navigateTo(url)
      } else {
        goLogin(url)
      }
    },
    // 退出登录
    handleLogout() {
      uni.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            clearAuth()
            this.localUser = null
            this.setUserInfo(null)
            this.setUserType('')
            uni.showToast({
              title: '已退出登录',
              icon: 'success'
            })
            uni.reLaunch({ url: '/pages/index/index' })
          }
        }
      })
    },
    // 跳转到登录页
    login() {
      goLogin('/pages/mine/mine')
    },
    switchToEmployer() {
      uni.navigateTo({ url: '/pages/employer/index' })
    },
    // 页面跳转
    navigateTo(url) {
      navigate(url)
    },
    // 底部导航
    navTo(page) {
      const routes = {
        index: '/pages/index/index',
        task: '/pages/jobSearch/jobSearch',
        message: '/pages/message/index',
        my: '/pages/mine/mine'
      }

      if (routes[page] && page !== 'my') {
        uni.switchTab({
          url: routes[page]
        })
      }
    }
  }
}
</script>
<style scoped>
.profile-cover {
  position: relative;
  background: #2563eb;
  color: #fff;
  padding: 60rpx 44rpx 110rpx;
}
.profile-row {
  display: flex;
  gap: 28rpx;
  align-items: center;
  padding-right: 24px;
}
.profile-avatar {
  padding: 0;
  margin: 0;
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  border: 7rpx solid rgba(255, 255, 255, 0.25);
  background: #4b80ee;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.profile-avatar image {
  width: 100%;
  height: 100%;
}
.profile-info {
  min-width: 0;
}
.profile-name {
  font-size: 26px;
  font-weight: 650;
  margin: 0;
  padding: 0;
  background: transparent;
  color: #fff;
  text-align: left;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.profile-badges {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
}
.id-badge,
.verified-badge {
  border-radius: 8rpx;
  padding: 6rpx 14rpx;
  font-size: var(--font-caption);
  background: rgba(255, 255, 255, 0.2);
}
.verified-badge {
  background: #ff963b;
}
.settings {
  position: absolute;
  right: 34rpx;
  padding: 8rpx;
  background: transparent;
  line-height: 44px;
  min-width: 44px;
  min-height: 44px;
}
.login {
  color: #fff;
  background: rgba(255, 255, 255, 0.17);
  margin-top: 16rpx;
  padding: 0 24rpx;
  font-size: var(--font-small);
  line-height: 64rpx;
}
.mine-body {
  padding: 0 32rpx;
}
.wallet-card {
  position: relative;
  margin-top: -64rpx;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
  align-items: center;
  gap: 24rpx;
  background: #fff;
  padding: 40rpx 30rpx;
  border-radius: 32rpx;
  box-shadow: 0 12rpx 36rpx rgba(35, 63, 106, 0.06);
  margin-bottom: 28rpx;
}
.wallet-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: center;
  gap: 12rpx;
  font-size: var(--font-small);
  color: var(--muted);
  min-width: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  line-height: 1.5;
}
.wallet-number {
  font-size: 22px;
  line-height: 1.2;
  font-weight: 700;
  color: var(--ink);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.wallet-divider {
  width: 1rpx;
  height: 80rpx;
  background: var(--line);
}
.wallet-button {
  grid-column: 1 / -1;
  width: 100%;
  margin: 0;
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: 16rpx;
  font-size: var(--font-small);
  line-height: 44px;
  min-height: 44px;
  padding: 0 28rpx;
}
.quick-services {
  display: flex;
  justify-content: space-around;
  padding: 30rpx 16rpx;
}
.quick-services button {
  background: transparent;
  margin: 0;
  padding: 8rpx;
  font-size: var(--font-small);
  line-height: 1.6;
  color: var(--ink);
  display: flex;
  align-items: center;
  flex-direction: column;
}
.quick-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  transition: transform 160ms var(--ease-out);
}
.shortcut-pressed .quick-icon {
  transform: scale(0.92);
}
.service-pressed {
  background: var(--primary-soft);
}
@media (prefers-reduced-motion: reduce) {
  .quick-icon {
    transition: none;
  }
  .shortcut-pressed .quick-icon {
    transform: none;
  }
}
.favorite {
  background: #fff0f2;
}
.services {
  padding: 8rpx 32rpx;
}
.menu-heading {
  display: block;
  padding: 24rpx 0 8rpx;
  font-size: var(--font-caption);
  font-weight: 600;
  color: var(--muted);
}
.service-row {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 26rpx 0;
  min-height: 104rpx;
  border-bottom: 1rpx solid var(--line);
  margin: 0;
  border-radius: 0;
  background: #fff;
  font-size: var(--font-control);
  line-height: 1.5;
  text-align: left;
}
.service-row:last-child {
  border: 0;
}
.service-label {
  flex: 1;
  color: var(--ink);
}
.verified-status {
  color: #16a05a;
  font-size: var(--font-small);
}
.logout-btn {
  color: #e5484d;
  background: transparent;
  font-size: var(--font-body);
  margin-top: 32rpx;
}
</style>
