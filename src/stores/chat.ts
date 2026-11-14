import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, getToken, mediaUrl, post, upload, wsUrl } from '@/api'

export interface ChatMessage {
  id: number
  class_id: number
  sender_role: 'teacher' | 'student'
  kind: 'text' | 'image' | 'voice'
  body: string
  has_media: boolean
  media_mime: string | null
  media_duration_ms: number | null
  created_at: string
}

type ConnState = 'off' | 'connecting' | 'open' | 'retrying'

/**
 * 班级消息群（班主任 ↔ 值日生一体机）。
 * 实时：WebSocket（每班一个 Durable Object）；断线自动重连 + after 增量补拉。
 */
export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const conn = ref<ConnState>('off')
  const unread = ref(0)
  const popup = ref<ChatMessage | null>(null) // 大板全屏弹出卡片（收到的老师消息）

  let classId = 0
  let ws: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let retryDelay = 1000
  let manuallyClosed = false

  function reset() {
    manuallyClosed = true
    ws?.close()
    ws = null
    if (retryTimer) clearTimeout(retryTimer)
    if (pingTimer) clearInterval(pingTimer)
    classId = 0
    messages.value = []
    unread.value = 0
    popup.value = null
    conn.value = 'off'
    manuallyClosed = false
  }

  function maxId(): number {
    return messages.value.length ? messages.value[messages.value.length - 1].id : 0
  }

  async function loadHistory(cid: number, after = 0): Promise<void> {
    const res = await get<{ messages: ChatMessage[] }>(
      `/api/classes/${cid}/messages?after=${after}&limit=300`,
    )
    if (after === 0) {
      messages.value = res.messages
    } else if (res.messages.length) {
      const seen = new Set(messages.value.map((m) => m.id))
      for (const m of res.messages) if (!seen.has(m.id)) messages.value.push(m)
    }
  }

  function connect(cid: number, onIncoming?: (m: ChatMessage) => void): void {
    const token = getToken()
    if (!token || !cid) return
    if (ws && classId === cid && (conn.value === 'open' || conn.value === 'connecting')) return

    manuallyClosed = false
    classId = cid
    conn.value = 'connecting'
    ws?.close()

    const socket = new WebSocket(wsUrl(`/api/classes/${cid}/messages/ws?token=${token}`))
    ws = socket

    socket.onopen = () => {
      if (ws !== socket) return
      conn.value = 'open'
      retryDelay = 1000
      // 重连补拉断线期间的消息
      loadHistory(cid, maxId()).catch(() => {})
      if (pingTimer) clearInterval(pingTimer)
      pingTimer = setInterval(() => {
        try {
          socket.send('ping')
        } catch {
          /* ignore */
        }
      }, 30_000)
    }

    socket.onmessage = (ev) => {
      if (ws !== socket) return
      try {
        const data = JSON.parse(ev.data as string)
        if (data.type === 'message') {
          const m = data.message as ChatMessage
          if (!messages.value.some((x) => x.id === m.id)) {
            messages.value.push(m)
            unread.value++
            if (m.sender_role === 'teacher') {
              popup.value = m
              onIncoming?.(m)
            }
          }
        }
      } catch {
        /* ignore malformed */
      }
    }

    socket.onclose = () => {
      if (ws !== socket) return
      ws = null
      if (pingTimer) clearInterval(pingTimer)
      if (manuallyClosed) {
        conn.value = 'off'
        return
      }
      conn.value = 'retrying'
      retryTimer = setTimeout(() => connect(cid, onIncoming), retryDelay)
      retryDelay = Math.min(retryDelay * 2, 30_000)
    }

    socket.onerror = () => socket.close()
  }

  async function sendText(cid: number, body: string): Promise<void> {
    const res = await post<{ message: ChatMessage }>(`/api/classes/${cid}/messages`, {
      body,
    })
    if (!messages.value.some((m) => m.id === res.message.id)) messages.value.push(res.message)
  }

  async function sendMedia(
    cid: number,
    kind: 'image' | 'voice',
    blob: Blob,
    mime: string,
    durationMs?: number,
  ): Promise<void> {
    const q = new URLSearchParams({ kind, mime })
    if (kind === 'voice' && durationMs) q.set('duration', String(durationMs))
    const res = await upload<{ message: ChatMessage }>(
      `/api/classes/${cid}/messages/upload?${q.toString()}`,
      blob,
    )
    if (!messages.value.some((m) => m.id === res.message.id)) messages.value.push(res.message)
  }

  function markAllRead(): void {
    unread.value = 0
  }

  function mediaSrc(m: ChatMessage): string {
    return mediaUrl(m.class_id, m.id)
  }

  return {
    messages,
    conn,
    unread,
    popup,
    connect,
    reset,
    loadHistory,
    sendText,
    sendMedia,
    markAllRead,
    mediaSrc,
  }
})
