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
  return { aiEnabled: enabled, ensureStatus }
}
