import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, getToken, mediaUrl, post, upload, wsUrl } from '@/api'
import { useIdentityStore } from '@/stores/identity'

export interface ChatMessage {
  id: number
  class_id: number
  sender_role: 'teacher' | 'student'
  sender_name?: string
  actor_student_id?: number | null
  popup?: boolean
  kind: 'text' | 'image' | 'voice'
  body: string
  has_media: boolean
  media_mime: string | null
  media_duration_ms: number | null
  created_at: string
}

type ConnState = 'off' | 'connecting' | 'open' | 'retrying'

/** 离线待发队列条目（仅文字；媒体文件不入 localStorage） */
interface PendingMsg {
  classId: number
  body: string
  queuedAt: string
}

const QUEUE_KEY = 'ark-msg-queue'
const SEEN_PREFIX = 'ark-seen-'

/**
 * 班级消息群（班主任 ↔ 值日生一体机）。
 *
 * 实时：WebSocket（每班一个 Durable Object）；断线自动重连 + after 增量补拉。
 * 离线优先：
 *  - 发送不依赖连接——接口不可达时文字消息进入本地队列，恢复后自动重发
 *  - 上线（重连/打开页面/网络恢复）→ refreshTick 全量同步信号，各板块自动重拉
 *  - 补拉后对比本地已读水位，离线期间的新消息弹「离线摘要」提醒
 */
export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const conn = ref<ConnState>('off')
  const unread = ref(0)
  /** 收到数据变更广播或上线全量同步时 +1，各板块监听后重拉 */
  const refreshTick = ref(0)
  const popup = ref<ChatMessage | null>(null) // 大板全屏弹出卡片（收到的老师消息）
  /** 离线摘要：补拉后发现的新消息 */
  const offlineSummary = ref<{ count: number; last: ChatMessage | null } | null>(null)
  /** 待发队列长度（发消息 UI 可显示「排队中」） */
  const pendingCount = ref(0)

  let classId = 0
  let ws: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let retryDelay = 1000
  let manuallyClosed = false
  let flushing = false

  /* ---------- 本地已读水位（离线摘要依据） ---------- */

  function seenId(cid: number): number {
    return Number(localStorage.getItem(SEEN_PREFIX + cid) ?? 0)
  }
  function markSeenId(cid: number, id: number): void {
    if (id > seenId(cid)) localStorage.setItem(SEEN_PREFIX + cid, String(id))
  }

  /* ---------- 离线待发队列 ---------- */

  function readQueue(): PendingMsg[] {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
    } catch {
      return []
    }
  }
  function writeQueue(q: PendingMsg[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
    pendingCount.value = q.length
  }

  function enqueue(cid: number, body: string): void {
    const q = readQueue()
    q.push({ classId: cid, body, queuedAt: new Date().toISOString() })
    writeQueue(q)
  }

  /** 队列重发：逐条发送，失败即停（保持剩余队列）。 */
  async function flushQueue(): Promise<void> {
    if (flushing) return
    const q = readQueue()
    if (!q.length) return
    flushing = true
    try {
      while (q.length) {
        const item = q[0]
        await post(`/api/classes/${item.classId}/messages`, { body: item.body })
        q.shift()
        writeQueue(q)
      }
    } catch {
      // 网络/服务端仍不可达：保留队列，等下次触发
    } finally {
      flushing = false
    }
  }

  /* ---------- 生命周期 ---------- */

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

    // 离线摘要：全量补拉后对比本地已读水位
    if (after === 0) {
      const stored = seenId(cid)
      const fresh = messages.value.filter((m) => m.id > stored)
      if (stored > 0 && fresh.length > 0) {
        unread.value += fresh.length
        const last = fresh[fresh.length - 1]
        offlineSummary.value = { count: fresh.length, last }
      }
      if (messages.value.length) markSeenId(cid, maxId())
    } else if (res.messages.length) {
      markSeenId(cid, maxId())
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
      // 重连补拉断线期间的消息 + 冲刷离线队列
      loadHistory(cid, maxId()).catch(() => {})
      flushQueue().catch(() => {})
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
        if (data.type === 'refresh') {
          refreshTick.value++
          return
        }
        if (data.type === 'message-deleted') {
          messages.value = messages.value.filter((x) => x.id !== data.id)
          return
        }
        if (data.type === 'message') {
          const m = data.message as ChatMessage
          if (!messages.value.some((x) => x.id === m.id)) {
            messages.value.push(m)
            unread.value++
            markSeenId(cid, m.id)
            if (m.sender_role === 'teacher') {
              if (m.popup !== false) popup.value = m
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

  async function sendText(cid: number, body: string, popup = true): Promise<{ queued: boolean }> {
    const identity = useIdentityStore()
    try {
      const res = await post<{ message: ChatMessage }>(`/api/classes/${cid}/messages`, {
        body,
        popup,
        actor_student_id: identity.studentId ?? undefined,
      })
      if (!messages.value.some((m) => m.id === res.message.id)) messages.value.push(res.message)
      markSeenId(cid, res.message.id)
      return { queued: false }
    } catch (e: any) {
      // 网络/后端不可达：进本地队列，恢复后自动重发
      enqueue(cid, body)
      return { queued: true }
    }
  }

  async function sendMedia(
    cid: number,
    kind: 'image' | 'voice',
    blob: Blob,
    mime: string,
    durationMs?: number,
    popup = true,
  ): Promise<void> {
    const identity = useIdentityStore()
    const q = new URLSearchParams({ kind, mime })
    if (identity.studentId) q.set('actor', String(identity.studentId))
    q.set('popup', popup ? '1' : '0')
    if (kind === 'voice' && durationMs) q.set('duration', String(durationMs))
    const res = await upload<{ message: ChatMessage }>(
      `/api/classes/${cid}/messages/upload?${q.toString()}`,
      blob,
    )
    if (!messages.value.some((m) => m.id === res.message.id)) messages.value.push(res.message)
    markSeenId(cid, res.message.id)
  }

  async function deleteMessage(cid: number, msgId: number): Promise<void> {
    const { del } = await import('@/api')
    await del(`/api/classes/${cid}/messages/${msgId}`)
    messages.value = messages.value.filter((x) => x.id !== msgId)
  }

  function markAllRead(): void {
    unread.value = 0
    if (classId) markSeenId(classId, maxId())
  }

  function mediaSrc(m: ChatMessage): string {
    return mediaUrl(m.class_id, m.id)
  }

  /* 网络恢复：重连 + 冲刷队列 + 全量同步信号 */
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (classId) {
        connect(classId)
        refreshTick.value++
        flushQueue().catch(() => {})
      }
    })
  }

  return {
    messages,
    conn,
    unread,
    refreshTick,
    popup,
    offlineSummary,
    pendingCount,
    connect,
    reset,
    loadHistory,
    sendText,
    sendMedia,
    deleteMessage,
    markAllRead,
    markSeenId,
    flushQueue,
    mediaSrc,
  }
})
