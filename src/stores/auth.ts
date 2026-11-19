import { defineStore } from 'pinia'
import { get, post, setToken } from '@/api'

export interface AuthUser {
  userId: number
  role: 'teacher' | 'admin' | 'student'
  name: string
  /** student 会话绑定的班级 */
  classId?: number
  /** 所属学校：admin 未挂 = 平台超管；admin 非空 = 校管理员；教师 = 所属学校 */
  schoolId?: number | null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    checked: false,
  }),
  actions: {
    async fetchMe() {
      try {
        const { user } = await get<{ user: AuthUser }>('/api/auth/me')
        this.user = user
      } catch {
        this.user = null
        setToken('')
      } finally {
        this.checked = true
      }
    },
    async login(name: string, password: string) {
      const res = await post<{ token: string; user: AuthUser }>('/api/auth/login', {
        name,
        password,
      })
      setToken(res.token)
      this.user = res.user
    },
    async activate(code: string, name: string, password: string) {
      const res = await post<{ token: string; user: AuthUser }>('/api/auth/activate', {
        code,
        name,
        password,
      })
      setToken(res.token)
      this.user = res.user
    },
    logout() {
      post('/api/auth/logout').catch(() => {})
      setToken('')
      this.user = null
    },
  },
})
