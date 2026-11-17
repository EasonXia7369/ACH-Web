import { ref } from 'vue'
import { isDesktop } from '@/utils/platform'

/**
 * 页面内 + 系统通知（v1）。
 * - Web：浏览器 Notification（页面在后台时弹系统通知，需用户授权一次）
 * - Electron 桌面端：同用 HTML5 Notification（Chromium 直接渲染为系统通知，无需授权弹窗）
 * - 提示音：WebAudio 合成短音，不依赖音频文件
 */
const permission = ref<NotificationPermission | 'unsupported'>(
  isDesktop
    ? 'granted'
    : typeof Notification === 'undefined'
      ? 'unsupported'
      : Notification.permission,
)

export function useNotify() {
  async function requestPermission(): Promise<boolean> {
    if (permission.value === 'unsupported') return false
    if (permission.value === 'granted') return true
    if (permission.value === 'denied') return false
    if (isDesktop) return true
    const res = await Notification.requestPermission()
    permission.value = res
    return res === 'granted'
  }

  async function showNotification(title: string, body: string): Promise<void> {
    if (permission.value !== 'granted') return
    if (document.visibilityState === 'visible') return // 可见时页面内已有弹窗
    try {
      new Notification(title, { body, tag: 'ark-message' })
    } catch {
      // 部分浏览器要求 SW 通知，失败静默
    }
  }

  function beep(pattern: 'incoming' | 'sent' = 'incoming'): void {
    try {
      const Ctx =
        (window as any).AudioContext ?? (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const seq =
        pattern === 'incoming'
          ? [880, 0, 1180]
          : [1180]
      let t = ctx.currentTime
      for (const freq of seq) {
        if (freq > 0) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(0.18, t)
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.2)
        }
        t += 0.22
      }
      setTimeout(() => ctx.close(), 1500)
    } catch {
      // 无音频设备时静默
    }
  }

  return { permission, requestPermission, showNotification, beep }
}
