import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
// MiSans：现代中文无衬线（unicode-range 分片，浏览器按需加载实际用到的字形）
import 'misans/lib/Normal/MiSans-Regular.min.css'
import 'misans/lib/Normal/MiSans-Medium.min.css'
import 'misans/lib/Normal/MiSans-Semibold.min.css'
import 'misans/lib/Normal/MiSans-Bold.min.css'
import './styles/tokens.css'
import './styles/ui.css'

createApp(App).use(createPinia()).use(router)

// 等首次路由解析完成（守卫跑完）再挂载：
// 否则公开页（家长视图/一体机门）会在无令牌状态下短暂挂载应用骨架，
// 触发 loadClasses 的 401 → 被全局拦截器误跳登录页
router.isReady().then(() => {
  app.mount('#app')
})
