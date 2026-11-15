<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { get, post, setToken } from '@/api'
import Icon from '@/components/Icon.vue'

const router = useRouter()

const KIOSK_TOKEN_KEY = 'ark-kiosk-token'
const KIOSK_CLASS_KEY = 'ark-kiosk-class'

interface KioskClass {
  id: number
  name: string
  has_pass: number
}
const classes = ref<KioskClass[]>([])
const classId = ref<number | null>(null)
const password = ref('')
const loginError = ref('')
const loggingIn = ref(false)

async function kioskLogin() {
  loginError.value = ''
  if (!classId.value || !password.value) {
    loginError.value = '请选择班级并输入密码'
    return
  }
  loggingIn.value = true
  try {
    const res = await post<{ token: string; classId: number; className: string }>(
      `/api/classes/${classId.value}/kiosk-login`,
      { password: password.value },
    )
    // 学生令牌双写：ark-token 用于本次会话，ark-kiosk-token 用于锁屏后自动恢复
    localStorage.setItem(KIOSK_TOKEN_KEY, res.token)
    localStorage.setItem(KIOSK_CLASS_KEY, String(res.classId))
    setToken(res.token)
    router.replace('/board')
  } catch (e: any) {
    loginError.value = e.message
  } finally {
    loggingIn.value = false
  }
}

onMounted(async () => {
  // 已解锁的一体机：直接进大板
  const saved = localStorage.getItem(KIOSK_TOKEN_KEY)
  if (saved) {
    try {
      setToken(saved)
      const me = await get<{ user: any }>('/api/auth/me')
      if (me.user?.role === 'student') {
        router.replace('/board')
        return
      }
    } catch {
      // 会话过期，走正常登录
    }
  }
  const res = await get<{ classes: KioskClass[] }>('/api/kiosk/classes')
  classes.value = res.classes.filter((c) => c.has_pass)
})
</script>

<template>
  <main class="login">
    <div class="box glass-strong">
      <div class="logo"><Icon name="monitor" :size="22" /></div>
      <div class="brand-cn">方舟班级中心</div>
      <h1>一体机登记</h1>
      <p class="tip">
        选择班级，输入学生密码进入大板登记模式。操作会以「值日生」身份记录到日志。
      </p>
      <label>班级</label>
      <select v-model.number="classId" class="gselect" style="width: 100%">
        <option :value="null" disabled>选择班级</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <label>学生密码</label>
      <input
        v-model="password"
        class="ginput"
        style="width: 100%"
        type="password"
        placeholder="教室一体机密码"
        @keyup.enter="kioskLogin"
      />
      <p v-if="loginError" class="err">{{ loginError }}</p>
      <button class="gbtn primary unlock" :disabled="loggingIn" @click="kioskLogin">
        <Icon name="lock" :size="16" />
        {{ loggingIn ? '解锁中…' : '解锁进入大板' }}
      </button>
      <p class="alt"><RouterLink to="/login">教师登录</RouterLink></p>
    </div>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 16px;
}
.box {
  width: 100%;
  max-width: 380px;
  padding: 26px 24px;
}
.logo {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f6ef7, #2f49b2);
  color: #fff;
  display: grid;
  place-items: center;
  margin-bottom: 12px;
}
.brand-cn {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--faint);
  margin: 10px 0 0;
}
h1 {
  margin: 0;
  font-size: 19px;
}
.tip {
  margin: 6px 0 14px;
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.7;
}
label {
  display: block;
  font-size: 12.5px;
  color: var(--muted);
  margin: 12px 0 5px;
  font-weight: 600;
}
.unlock {
  width: 100%;
  margin-top: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.err {
  margin: 10px 0 0;
}
.alt {
  margin: 14px 0 0;
  font-size: 12.5px;
  color: var(--muted);
  text-align: center;
}
.alt a {
  color: var(--primary);
}
</style>
