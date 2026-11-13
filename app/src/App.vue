<script>
import { initCloud } from './api/cloud'
import { DEV_API_BASE, HTTP_API_BASE } from './config'
import api from './api/index.js'
import { getUser, setUser, clearAuth } from './utils/auth'
import { loadContent } from './utils/content'

export default {
  onLaunch() {
    if (!DEV_API_BASE) {
      try {
        initCloud()
      } catch (e) {
        console.error('云开发初始化失败：', e.message)
      }
    }
    this.syncUser()
    loadContent().catch(() => {})
  },
  onShow() {},
  onHide() {},
  methods: {
    async syncUser() {
      if (!getUser() || (HTTP_API_BASE && !uni.getStorageSync('token'))) {
        clearAuth()
        this.$store.commit('setAuthReady', true)
        return
      }
      setUser(getUser())
      try {
        const res = await api.getUserProfile({ authPrompt: false })
        this.$store.commit('setUserInfo', res.data)
        setUser(res.data)
      } catch (e) {
        if (e && (e.code === 401 || e.code === 403)) clearAuth()
      } finally {
        this.$store.commit('setAuthReady', true)
      }
    }
  }
}
</script>

<style lang="scss">
/* ColorUI 全局样式：导航栏、图标、按钮、卡片都依赖它 */
@import 'colorui/main.css';
@import 'colorui/icon.css';
@import 'styles/tokens.scss';

page {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, 'Segoe UI', Arial, Roboto,
    'PingFang SC', 'miui', 'Hiragino Sans GB', 'Microsoft Yahei', sans-serif;
  background-color: var(--canvas);
  font-size: var(--font-body);
  color: var(--ink);
  box-sizing: border-box;
}
</style>
