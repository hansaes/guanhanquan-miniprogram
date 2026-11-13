import { createSSRApp } from 'vue'
import App from './App.vue'
import store from './store'
import jobCard from './components/job-card.vue'
import identitySwitch from './components/identity-switch.vue'
import cuCustom from './colorui/components/cu-custom.vue'
import navBar from './components/nav-bar.vue'
import AppTabbar from './components/app-tabbar.vue'
import PageState from './components/page-state.vue'
import RegionPicker from './components/region-picker.vue'
import OptionPicker from './components/option-picker.vue'
import AuthGate from './components/auth-gate.vue'
import { getSystemMetrics } from './utils/system'

export function createApp() {
  const app = createSSRApp(App)

  app.use(store)

  // ColorUI 依赖的全局尺寸（替代 Vue2 的 Vue.prototype.StatusBar）
  const { StatusBar, CustomBar } = getSystemMetrics()
  app.config.globalProperties.StatusBar = StatusBar
  app.config.globalProperties.CustomBar = CustomBar

  app.component('job-card', jobCard)
  app.component('identity-switch', identitySwitch)
  app.component('cu-custom', cuCustom)
  app.component('nav-bar', navBar)
  app.component('app-tabbar', AppTabbar)
  app.component('page-state', PageState)
  app.component('region-picker', RegionPicker)
  app.component('option-picker', OptionPicker)
  app.component('auth-gate', AuthGate)

  return { app }
}
