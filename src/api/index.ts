const TOKEN_KEY = 'ark-token'

/**
 * API 地址：本地开发走 vite 代理（空串 + /api 相对路径），
 * 生产由 .env.production 的 VITE_API_BASE 注入独立 API 域名。
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? ''

/** WebSocket 地址：https→wss / http→ws，同 API 域名 */
export function wsUrl(path: string): string {
  const base = API_BASE || location.origin
  return base.replace(/^http/, 'ws') + path
}

/** 原始二进制上传（媒体消息用） */
export async function upload<T = any>(
  path: string,
  body: ArrayBuffer | Uint8Array | Blob,
): Promise<T> {
  const headers: Record<string, string> = { ...pushDeviceHeader() }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  headers['Content-Type'] = 'application/octet-stream'
  const res = await fetch(API_BASE + path, { method: 'POST', headers, body: body as any })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? `上传失败（${res.status}）`, res.status)
  return data as T
}

/** 拼接媒体取回地址（img/audio 标签用，token 走 query） */
export function mediaUrl(classId: number, msgId: number): string {
  return `${API_BASE}/api/classes/${classId}/messages/media/${msgId}?token=${getToken()}`
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

/**
 * 本设备推送标识（usePush 生成）：随请求上报，
 * 服务端推送时排除发起操作的设备自身（自己操作不提醒自己）。
 */
function pushDeviceHeader(): Record<string, string> {
  const id = localStorage.getItem('ark-push-device')
  return id ? { 'X-Push-Device': id } : {}
}

export function setToken(token: string): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { ...pushDeviceHeader() }
  const token = getToken()
  const hadToken = !!token
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // 会话失效（曾有令牌而现在 401）：一体机回密码门，教师回登录页。
    // 从未登录过的公开页（如家长视图）不跳转，避免误伤
    if (res.status === 401 && hadToken && !path.startsWith('/api/auth/')) {
      const wasKiosk = !!localStorage.getItem('ark-kiosk-token')
      setToken('')
      const target = wasKiosk ? '/kiosk' : '/login'
      if (!location.pathname.startsWith(target)) {
        location.replace(target)
      }
    }
    throw new ApiError(data.error ?? `请求失败（${res.status}）`, res.status)
  }
  return data as T
}

export const get = <T = any>(path: string) => api<T>('GET', path)
export const post = <T = any>(path: string, body?: unknown) => api<T>('POST', path, body)
export const put = <T = any>(path: string, body?: unknown) => api<T>('PUT', path, body)
export const del = <T = any>(path: string) => api<T>('DELETE', path)
