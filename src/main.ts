import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { isDesktop } from './utils/platform'
// MiSans：现代中文无衬线（unicode-range 分片，浏览器按需加载实际用到的字形）
import 'misans/lib/Normal/MiSans-Regular.min.css'
import 'misans/lib/Normal/MiSans-Medium.min.css'
import 'misans/lib/Normal/MiSans-Semibold.min.css'
import 'misans/lib/Normal/MiSans-Bold.min.css'
import './styles/tokens.css'
import './styles/ui.css'

const app = createApp(App).use(createPinia()).use(router)

// 等首次路由解析完成（守卫跑完）再挂载：
// 否则公开页（家长视图/一体机门）会在无令牌状态下短暂挂载应用骨架，
// 触发 loadClasses 的 401 → 被全局拦截器误跳登录页
router.isReady().then(() => {
  app.mount('#app')
})

/* PWA 自更新（仅生产构建，桌面端跳过——桌面版本随壳更新）：
 * sw.js 本身已带 skipWaiting + clientsClaim + cleanupOutdatedCaches，这里补齐设备侧闭环——
 * 1) 定期 + 回前台时主动检查更新：长期开着的大板/一体机不用任何操作即可拿到新版；
 * 2) 新 SW 接管（controllerchange）时整页刷新：否则旧页面之后懒加载的旧分片
 *    可能已被清理而 404 白屏（这正是之前要清站点数据才能恢复的原因）。
 * updateViaCache: 'none' 绕过 HTTP 缓存检查 sw.js（Cloudflare Pages 给它的 TTL 有 4 小时）。 */
if (!isDesktop && import.meta.env.PROD && 'serviceWorker' in navigator) {
  const swReady = navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  })
  if (navigator.serviceWorker.controller) {
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      location.reload()
    })
  }
  const checkUpdate = () => swReady.then((reg) => reg.update()).catch(() => {})
  setInterval(checkUpdate, 30 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkUpdate()
  })
}
