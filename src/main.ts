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

createApp(App).use(createPinia()).use(router).mount('#app')
