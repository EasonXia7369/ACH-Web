import { ref } from 'vue'
import { get } from '@/api'

/** AI 能力开关（会话级缓存：/api/ai/status 拉一次）。未配置时所有 AI 入口隐藏。 */
const enabled = ref<boolean | null>(null)
let fetched = false

export function useAi() {
  async function ensureStatus() {
    if (fetched) return
    fetched = true
    try {
      const res = await get<{ enabled: boolean }>('/api/ai/status')
      enabled.value = res.enabled
    } catch {
      enabled.value = false
    }
  }
  /** 保存 AI 配置后调用：强制下次拉取最新状态 */
  function invalidate() {
    fetched = false
    enabled.value = null
  }
  return { aiEnabled: enabled, ensureStatus, invalidate }
}
