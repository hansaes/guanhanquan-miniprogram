<template>
  <view class="ui-page">
    <cu-custom isBack><template #content>个人资料</template></cu-custom>
    <auth-gate title="登录后管理个人资料" @ready="load">
      <view class="ui-body">
        <page-state v-if="loading || error" :loading="loading" :error="error" @retry="load" />
        <view v-else class="ui-card"><profile-form :user="user" @saved="saved" /></view>
      </view>
    </auth-gate>
  </view>
</template>
<script>
import api from '@/api'
import { setUser } from '@/utils/auth'
import ProfileForm from '@/components/profile-form.vue'
export default {
  components: { ProfileForm },
  data: () => ({ loading: true, error: '', user: {} }),
  methods: {
    async load() {
      this.loading = true
      this.error = ''
      try {
        const result = await api.getUserProfile()
        this.user = result.data
        setUser(result.data)
      } catch {
        this.error = '个人资料加载失败'
      } finally {
        this.loading = false
      }
    },
    saved() {
      uni.showToast({ title: '资料已保存', icon: 'success' })
      if (getCurrentPages().length > 1) uni.navigateBack()
      else uni.switchTab({ url: '/pages/mine/mine' })
    }
  }
}
</script>
