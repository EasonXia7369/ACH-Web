import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { mockApiHandler } from './mock/server.js'

/** 纯前端预览（`npm run dev:mock`，即 --mode mock 时启用）：接管 /api/*，无需启动后端。 */
function mockServer(): Plugin {
  return {
    name: 'mock-api-server',
    apply: 'serve',
    configureServer(server) {
      if (server.config.mode !== 'mock') return
      server.middlewares.use(mockApiHandler())
      console.log('\n  [mock] 纯前端预览模式：/api/* 由 mock/server.js 接管，无需启动后端')
      console.log('  [mock] 登录账号随意（用户名/密码任意），角色：演示老师\n')
    },
    // 同时禁用 /api 代理（mock 模式下由中间件接管，代理排在其后不会生效，但显式去掉更清晰）
  }
}

export default defineConfig(({ mode }) => ({
  // 构建时间戳：关于页展示「构建于」（每次构建刷新）
  define: {
    __BUILD_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    mockServer(),
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // 注册逻辑移到 main.ts 手写（需加定期检查 + controllerchange 自动刷新，
      // 自动注入的 registerSW.js 只有裸注册，长期开着的设备拿不到新版）
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '方舟班级中心 · Ark Class Hub',
        short_name: '班级中心',
        description: '班级考勤、作业、值日日常管理工作台',
        lang: 'zh-CN',
        theme_color: '#f5f5f7',
        background_color: '#f5f5f7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Web Push 事件处理（public/push-sw.js：push / notificationclick）
        importScripts: ['/push-sw.js'],
        // 接口请求走网络优先，失败回退缓存的最后一次结果（离线可看最近数据）
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // MiSans 分片字体：CacheFirst（不可变资源，长期缓存）
            urlPattern: /\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 31536000 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // mock 模式（纯前端预览）下 /api 由 mockServer 中间件接管，不走后端代理
    proxy: mode === 'mock' ? undefined : {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
}))
