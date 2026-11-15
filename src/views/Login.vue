<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BrandLogo from '@/components/BrandLogo.vue'

const router = useRouter()
const auth = useAuthStore()

const name = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await auth.login(name.value.trim(), password.value)
    router.replace(auth.user?.role === 'admin' ? '/admin' : '/board')
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
      <div class="logo"><BrandLogo :size="26" /></div>
      <h1>登录</h1>
      <p class="tip">教师或管理员账号登录。</p>
      <label>姓名</label>
      <input v-model="name" placeholder="激活时设置的姓名" @keyup.enter="submit" />
      <label>密码</label>
      <input v-model="password" type="password" placeholder="密码" @keyup.enter="submit" />
      <p v-if="error" class="err">{{ error }}</p>
      <button class="btn primary" :disabled="busy" @click="submit">
        {{ busy ? '登录中…' : '登录' }}
      </button>
      <p class="alt">第一次使用？<RouterLink to="/activate">用邀请码激活</RouterLink></p>
    </div>
  </main>
</template>

<style scoped src="@/styles/auth.css"></style>
