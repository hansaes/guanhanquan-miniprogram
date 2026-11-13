<template>
  <view class="ui-page employer-center">
    <cu-custom is-back><template #content>招工管理</template></cu-custom>
    <auth-gate title="登录后管理招工" target="/pages/employer/index" @ready="loadProfile">
      <page-state v-if="loading || error" :loading="loading" :error="error" @retry="loadProfile" />
      <view v-else class="ui-body">
        <button
          role="button"
          class="company-card ui-card"
          aria-label="查看和编辑企业资料"
          @tap="open('/pages/employer/certification')"
        >
          <view class="ui-avatar company-avatar">
            <image
              v-if="avatar && !avatarFailed"
              :src="avatar"
              mode="aspectFill"
              @error="avatarFailed = true"
            />
            <uni-icons v-else type="staff-filled" size="28" color="#2563eb" />
          </view>
          <view class="company-info">
            <text class="company-name">{{
              profile?.companyName || session.userInfo?.nickname || '招工方'
            }}</text>
            <text class="company-status" :class="{ verified: profile?.enterpriseVerified }">{{
              certificationLabel
            }}</text>
          </view>
          <uni-icons type="right" size="16" color="#657287" />
        </button>
        <button
          role="button"
          class="ui-button publish-button"
          @tap="open('/pages/employer/jobPost')"
        >
          <uni-icons type="plus" size="22" color="#fff" />
          <text>发布招工</text>
        </button>
        <view class="ui-card tools-card">
          <button
            v-for="item in actions"
            :key="item.path"
            role="button"
            :aria-label="item.label"
            class="tool-row"
            hover-class="tool-pressed"
            :hover-start-time="0"
            :hover-stay-time="120"
            @tap="open(item.path)"
          >
            <view class="tool-icon" aria-hidden="true"
              ><uni-icons :type="item.icon" size="23" color="#2563eb"
            /></view>
            <text class="tool-label">{{ item.label }}</text>
            <uni-icons type="right" size="16" color="#a2adbb" />
          </button>
        </view>
      </view>
    </auth-gate>
  </view>
</template>
<script>
import api from '@/api/index.js'
import { session, requireLogin } from '@/utils/auth'
import { navigate } from '@/utils/navigation'
export default {
  data: () => ({
    session,
    profile: null,
    loading: false,
    error: '',
    avatarFailed: false,
    actions: [
      { label: '岗位管理', icon: 'staff', path: '/pages/employer/jobManage' },
      { label: '报名管理', icon: 'personadd', path: '/pages/employer/applicants/list' },
      { label: '工人简历库', icon: 'contact', path: '/pages/employer/resume/index' },
      {
        label: '按工种找工人',
        icon: 'search',
        path: '/pages/category/categoryWorkers?id=&name=全部工种'
      }
    ]
  }),
  computed: {
    avatar() {
      return this.profile?.logo || this.session.userInfo?.avatar || ''
    },
    certificationLabel() {
      if (this.profile?.enterpriseVerified) return '企业已认证'
      if (this.profile?.enterpriseStatus === 0) return '企业资料审核中'
      if (this.profile?.enterpriseStatus === 2) return '企业资料待修改'
      return '完善企业资料'
    }
  },
  onShow() {
    if (session.authReady && session.userInfo?.id) this.loadProfile()
  },
  methods: {
    async loadProfile() {
      const owner = session.userInfo?.id
      if (!owner || this.loading) return
      this.loading = true
      this.error = ''
      try {
        const result = await api.getEmployerProfile()
        if (owner !== session.userInfo?.id) return
        this.profile = result.data
        this.avatarFailed = false
      } catch (error) {
        if (owner === session.userInfo?.id) this.error = '招工资料加载失败，请重试'
      } finally {
        this.loading = false
      }
    },
    open(path) {
      if (requireLogin(path)) navigate(path)
    }
  }
}
</script>
<style scoped>
.company-card {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  line-height: 1.5;
  width: 100%;
}
.company-avatar {
  width: 56px;
  height: 56px;
  border-radius: 18px;
}
.company-info {
  flex: 1;
  min-width: 0;
}
.company-name {
  display: block;
  font-size: var(--font-heading);
  font-weight: 600;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.company-status {
  display: block;
  margin-top: 6px;
  font-size: var(--font-small);
  color: var(--muted);
}
.company-status.verified {
  color: #16864b;
}
.publish-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 0 24rpx;
}
.tools-card {
  padding: 4px 16px;
}
.tool-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  margin: 0;
  min-height: 64px;
  background: transparent;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  text-align: left;
  line-height: 1.5;
}
.tool-row:last-child {
  border-bottom: 0;
}
.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--primary-soft);
}
.tool-label {
  flex: 1;
  color: var(--ink);
  font-size: var(--font-control);
}
.tool-pressed {
  background: var(--primary-soft);
}
</style>
