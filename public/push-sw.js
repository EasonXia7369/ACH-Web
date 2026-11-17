/**
 * Web Push 事件处理（由 workbox importScripts 引入主 sw.js）。
 * 服务端载荷：{ type, title, body, classId, url }
 * 同类型通知用 tag 覆盖，点击后聚焦已有窗口或打开对应板块。
 */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    // 非 JSON 载荷按纯文本展示
    data = { title: '方舟班级中心', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '方舟班级中心'
  const body = data.body || ''
  const url = data.url || '/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: data.type ? `ark-${data.type}` : 'ark-push',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // 已有窗口：聚焦并跳到对应板块（同源同 SPA，路由切换无需新开窗口）
      for (const client of clientList) {
        await client.focus()
        if ('navigate' in client) {
          try {
            const target = new URL(url, self.location.origin)
            if (client.url !== target.href) await client.navigate(target.href)
          } catch (e) {
            /* 导航失败只聚焦 */
          }
        }
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
