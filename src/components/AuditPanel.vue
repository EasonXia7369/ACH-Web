<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { get } from '@/api'

interface LogEntry {
  ts: string
  actor: 'teacher' | 'student' | 'admin'
  action: string
  detail: string
}

const props = defineProps<{ classId: number }>()

const logs = ref<LogEntry[]>([])
const error = ref('')

const ACTOR_LABEL: Record<string, string> = {
  teacher: '老师',
  student: '学生',
  admin: '管理员',
}

async function load(classId: number = props.classId) {
  error.value = ''
  try {
    logs.value = (await get<{ logs: LogEntry[] }>(`/api/classes/${classId}/audit`)).logs
  } catch (e: any) {
    error.value = e.message
  }
}

onMounted(() => load())
defineExpose({ load })
</script>

<template>
  <div class="glass pad">
    <p class="foot-note" style="margin: 0 0 10px">
      每次填写和修改都会记录操作时间与操作人（老师 / 学生 / 管理员），全员共用一份日志。
    </p>
    <p v-if="error" class="err">{{ error }}</p>
    <div v-if="logs.length" class="list">
      <div v-for="(l, i) in logs" :key="i" class="item">
        <span class="t num">{{ l.ts.slice(0, 16).replace('T', ' ') }}</span>
        <span class="u" :class="l.actor">{{ ACTOR_LABEL[l.actor] }}</span>
        <span class="a">{{ l.action }}<template v-if="l.detail"> · {{ l.detail }}</template></span>
      </div>
    </div>
    <p v-else class="empty">还没有修改记录</p>
  </div>
</template>

<style scoped>
.pad {
  padding: 16px 18px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 62vh;
  overflow: auto;
}
.item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  padding: 7px 2px;
  border-bottom: 1px solid var(--line-soft);
}
.t {
  color: var(--faint);
  flex: none;
}
.u {
  font-weight: 700;
  flex: none;
  width: 44px;
}
.u.student {
  color: var(--late);
}
.u.teacher {
  color: var(--primary);
}
.u.admin {
  color: var(--violate);
}
.a {
  color: var(--text);
  line-height: 1.5;
}
</style>
