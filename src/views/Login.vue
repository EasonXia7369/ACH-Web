<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BrandLogo from '@/components/BrandLogo.vue'
import Icon from '@/components/Icon.vue'

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
    <!-- 品牌区 -->
    <section class="brand-pane">
      <div class="brand-logo-row">
        <BrandLogo :size="64" />
        <div>
          <div class="brand-cn">方舟班级中心</div>
          <div class="brand-en">ARK CLASS HUB</div>
        </div>
      </div>
      <h1 class="brand-name">让班级事务<br />一目了然</h1>
      <p class="brand-tag">考勤 · 作业 · 值日 · 消息，<br />一间教室的全部日常。</p>
      <ul class="brand-feats">
        <li><span class="feat-icon"><Icon name="attendance" :size="17" /></span>出勤实时同步，请假一键审批</li>
        <li><span class="feat-icon"><Icon name="homework" :size="17" /></span>作业直达大屏，未交一目了然</li>
        <li><span class="feat-icon"><Icon name="chat" :size="17" /></span>师生消息即时送达</li>
      </ul>
    </section>

    <!-- 表单区 -->
    <section class="form-pane">
      <div class="form-box">
        <h2>登录</h2>
        <p class="tip">教师或管理员账号登录。</p>
        <label>姓名</label>
        <input v-model="name" placeholder="激活时设置的姓名" @keyup.enter="submit" />
        <label>密码</label>
        <input v-model="password" type="password" placeholder="密码" @keyup.enter="submit" />
        <p v-if="error" class="err">{{ error }}</p>
        <button class="btn primary" :disabled="busy" @click="submit">
          {{ busy ? '登录中…' : '登录' }}
        </button>
        <p class="alt">
          第一次使用？<RouterLink to="/activate">用邀请码激活</RouterLink>
          &nbsp;·&nbsp;
          <RouterLink to="/kiosk">一体机模式</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped src="@/styles/auth.css"></style>
