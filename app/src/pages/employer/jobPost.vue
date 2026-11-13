<template>
  <view class="ui-page">
    <cu-custom v-if="!session.userInfo" isBack><template #content>发布招工</template></cu-custom>
    <auth-gate title="登录后管理招工">
      <job-form
        v-if="ready && session.authReady && session.userInfo?.id"
        :key="session.userInfo.id"
        :job-id="jobId"
      />
    </auth-gate>
  </view>
</template>
<script>
import JobForm from '@/components/job-form.vue'
import { session } from '@/utils/auth'
export default {
  components: { JobForm },
  data: () => ({ session, jobId: '', ready: false }),
  onLoad(options) {
    this.jobId = options.id || ''
    this.ready = true
  }
}
</script>
