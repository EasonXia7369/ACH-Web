import { ref } from 'vue'
import { get, post } from '@/api'
import { isDesktop } from '@/utils/platform'

/**
 * Web Push（页面关闭后也能收到消息/业务提醒）。
 * - 仅网页端可用：依赖 Service Worker + PushManager（桌面壳的 Electron 不适用）
 * - iOS Safari 需先把站点添加到主屏幕（PWA 安装）才支持
 * - 设备 id：订阅时上报，推送时服务端排除"发起操作的设备"，自己不提醒自己
 */

const DEVICE_KEY = 'ark-push-device'

function ensureDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID?.() ?? `dev-${Math.random().toString(36).slice(2)}${Date.now()}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

/** base64url → Uint8Array（VAPID 公钥） */
function urlBase64ToUint8Array(b64: string): Uint8Array {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - (norm.length % 4)) % 4
  const bin = atob(norm + '='.repeat(pad))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const supported =
  !isDesktop &&
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  typeof Notification !== 'undefined'

const permission = ref<NotificationPermission | 'unsupported'>(supported ? Notification.permission : 'unsupported')
const subscribed = ref(false)
const busy = ref(false)
const error = ref('')
const serverEnabled = ref(true) // 服务端未配置 VAPID 时隐藏入口
let initialized = false

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported) return null
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    return reg ?? (await navigator.serviceWorker.ready.catch(() => null))
  } catch {
    return null
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await swRegistration()
  if (!reg) return null
  try {
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/** 读取当前订阅状态 + 服务端推送开关（进入消息板块时调用） */
async function init(): Promise<void> {
  if (!supported || initialized) return
  initialized = true
  try {
    const cfg = await get<{ enabled: boolean }>('/api/push/config')
    serverEnabled.value = !!cfg.enabled
  } catch {
    serverEnabled.value = false
  }
  subscribed.value = !!(await currentSubscription())
}

/** 开启推送：请求权限 → 生成订阅 → 上报服务端 */
async function enable(): Promise<boolean> {
  if (!supported || busy.value) return false
  error.value = ''
  busy.value = true
  try {
    const reg = await swRegistration()
    if (!reg) {
      error.value = 'Service Worker 未就绪，请刷新页面后重试'
      return false
    }
    let perm = Notification.permission
    if (perm === 'default') perm = await Notification.requestPermission()
    permission.value = perm
    if (perm !== 'granted') {
      error.value = perm === 'denied' ? '通知权限已被浏览器拒绝，请在站点设置中允许通知' : '未授权通知'
      return false
    }
    const cfg = await get<{ enabled: boolean; publicKey: string | null }>('/api/push/config')
    if (!cfg.enabled || !cfg.publicKey) {
      serverEnabled.value = false
      error.value = '服务端未开启推送'
      return false
    }
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as unknown as BufferSource,
      })
    }
    const keys = {
      p256dh: b64uFromBuffer(sub.getKey('p256dh')),
      auth: b64uFromBuffer(sub.getKey('auth')),
    }
    if (!keys.p256dh || !keys.auth) {
      error.value = '订阅密钥生成失败'
      return false
    }
    await post('/api/push/subscribe', {
      endpoint: sub.endpoint,
      keys,
      device_id: ensureDeviceId(),
    })
    subscribed.value = true
    return true
  } catch (e: any) {
    error.value = e?.message ?? '订阅失败'
    return false
  } finally {
    busy.value = false
  }
}

function b64uFromBuffer(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** 关闭推送：取消浏览器订阅 + 通知服务端删除 */
async function disable(): Promise<void> {
  if (!supported || busy.value) return
  busy.value = true
  try {
    const sub = await currentSubscription()
    if (sub) {
      await post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
    subscribed.value = false
  } finally {
    busy.value = false
  }
}

export function usePush() {
  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    serverEnabled,
    init,
    enable,
    disable,
  }
}
