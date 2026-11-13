<template>
  <view class="ui-page" :class="{ 'ui-tab-page': !session.userInfo }">
    <cu-custom v-if="!session.userInfo"><template #content>发布招工</template></cu-custom>
    <auth-gate title="登录后发布招工" target="/pages/publish/index">
      <job-form v-if="session.authReady && session.userInfo?.id" :key="session.userInfo.id" tab />
    </auth-gate>
    <app-tabbar :current="1" />
  </view>
</template>
<script>
import JobForm from '@/components/job-form.vue'
import { loadContent } from '@/utils/content'
import { session } from '@/utils/auth'
export default {
  components: { JobForm },
  data: () => ({ session }),
  onShow() {
    uni.hideTabBar({ animation: false })
    loadContent().catch(() => {})
  }
}
</script>
