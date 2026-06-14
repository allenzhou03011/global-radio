import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useLanguageStore } from './stores/language'
import './style.css'
import { Keyboard } from '@capacitor/keyboard'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 初始化语言系统并等待完成
const initApp = async () => {
  const languageStore = useLanguageStore()
  await languageStore.initLanguage()
  app.mount('#app')

  // 安卓平台下监听键盘事件，提升输入兼容性
  if (Capacitor.getPlatform() === 'android') {
    Keyboard.addListener('keyboardWillShow', () => {})
    Keyboard.addListener('keyboardDidShow', () => {})
    Keyboard.addListener('keyboardWillHide', () => {})
    Keyboard.addListener('keyboardDidHide', () => {})
  }
}

initApp()

// 注册 service worker。immediate=true 表示新 SW 装好立刻接管并触发整页刷新——
// 避免老 Capacitor WebView 卡在旧 bundle 上看不到新版本（v2.0.11 之前的痛点）。
// 同时每 30 分钟主动 update() 一次，保证后台跑着的 app 也能及时拿到新代码。
const SW_UPDATE_INTERVAL_MS = 30 * 60 * 1000

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    setInterval(() => {
      registration.update().catch(() => {})
    }, SW_UPDATE_INTERVAL_MS)
  },
  onNeedRefresh() {
    updateSW(true)
  },
})
