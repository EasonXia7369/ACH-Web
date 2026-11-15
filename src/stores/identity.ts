import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * T2 轻量学生身份：一体机（学生会话）操作前「认领身份」，
 * 记住在本设备上（按班级隔离），可随时切换。不是完整账号体系。
 */
export const useIdentityStore = defineStore('identity', () => {
  const studentId = ref<number | null>(null)
  const studentName = ref('')

  function key(classId: number): string {
    return `ark-identity-${classId}`
  }

  /** 从设备本地恢复已认领的身份 */
  function load(classId: number): { id: number; name: string } | null {
    try {
      const raw = JSON.parse(localStorage.getItem(key(classId)) ?? 'null')
      if (raw?.id && raw?.name) {
        studentId.value = raw.id
        studentName.value = raw.name
        return raw
      }
    } catch {
      /* ignore */
    }
    studentId.value = null
    studentName.value = ''
    return null
  }

  function claim(classId: number, id: number, name: string): void {
    studentId.value = id
    studentName.value = name
    localStorage.setItem(key(classId), JSON.stringify({ id, name }))
  }

  function clear(classId: number): void {
    studentId.value = null
    studentName.value = ''
    localStorage.removeItem(key(classId))
  }

  return { studentId, studentName, load, claim, clear }
})
