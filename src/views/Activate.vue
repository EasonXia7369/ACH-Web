<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const code = ref('')
const name = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  if (!code.value.trim() || !name.value.trim() || !password.value) {
    error.value = '请填写完整'
    return
  }
  if (password.value.length < 4) {
    error.value = '密码至少 4 位'
    return
  }
  if (password.value !== confirm.value) {
    error.value = '两次密码不一致'
    return
  }
  busy.value = true
  try {
    await auth.activate(code.value.trim(), name.value.trim(), password.value)
    router.replace('/board')
  } catch (e: any) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="auth">
    <div class="box">
      <div class="logo">✓</div>
      <h1>激活账号</h1>
      <p class="tip">输入学校管理员发放的邀请码，设置你的姓名和密码。</p>
      <label>邀请码</label>
      <input v-model="code" placeholder="8 位邀请码" autocomplete="off" @keyup.enter="submit" />
      <label>姓名</label>
      <input v-model="name" placeholder="如：张老师" maxlength="20" @keyup.enter="submit" />
      <label>设置密码</label>
      <input v-model="password" type="password" placeholder="至少 4 位" @keyup.enter="submit" />
      <label>确认密码</label>
      <input v-model="confirm" type="password" placeholder="再输一次" @keyup.enter="submit" />
      <p v-if="error" class="err">{{ error }}</p>
      <button class="btn primary" :disabled="busy" @click="submit">
        {{ busy ? '激活中…' : '激活并进入' }}
      </button>
      <p class="alt">已有账号？<RouterLink to="/login">直接登录</RouterLink></p>
    </div>
  </main>
</template>

<style scoped src="@/styles/auth.css"></style>
