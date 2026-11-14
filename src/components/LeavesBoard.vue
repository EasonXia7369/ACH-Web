<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { get, post, del } from '@/api'
import { useClassStore } from '@/stores/class'
import { dk } from '@/utils/dates'

const props = defineProps<{ classId: number }>()
const store = useClassStore()

interface Leave {
  id: number
  student_id: number
  name: string
  from_day: string
  to_day: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  decided_by_name: string | null
}

const leaves = ref<Leave[]>([])
const studentId = ref<number | null>(null)
const fromDay = ref(dk())
const toDay = ref(dk())
const reason = ref('')
const error = ref('')
const busy = ref(false)

const pending = computed(() => leaves.value.filter((l) => l.status === 'pending'))
const decided = computed(() => leaves.value.filter((l) => l.status !== 'pending'))

async function load() {
  const res = await get<{ leaves: Leave[] }>(`/api/classes/${props.classId}/leaves`)
  leaves.value = res.leaves
}

watch(() => props.classId, load, { immediate: true })

async function apply() {
  error.value = ''
  if (!studentId.value) {
    error.value = '请选择学生'
    return
  }
  if (fromDay.value > toDay.value) {
    error.value = '开始日期不能晚于结束日期'
    return
  }
  busy.value = true
  try {
    await post(`/api/classes/${props.classId}/leaves`, {
      student_id: studentId.value,
      from_day: fromDay.value,
      to_day: toDay.value,
      reason: reason.value,
    })
    reason.value = ''
    await load()
  } catch (e: any) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function decide(leave: Leave, approve: boolean) {
  await post(`/api/classes/${props.classId}/leaves/${leave.id}/decision`, { approve })
  await load()
}

async function remove(leave: Leave) {
  if (!confirm(`删除 ${leave.name} ${leave.from_day} ~ ${leave.to_day} 的请假单？已生成的请假考勤格会一并清除。`)) return
  await del(`/api/classes/${props.classId}/leaves/${leave.id}`)
  await load()
}

const STATUS_TEXT: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
}

function daysOf(l: Leave) {
  return dayjs(l.to_day).diff(dayjs(l.from_day), 'day') + 1
}
</script>

<template>
  <!-- 登记新请假 -->
  <div class="card pad">
    <h3 class="sec-title">登记请假</h3>
    <p class="tip">老师登记即时生效：自动在起止日期内每天三个时段填入「请假」，并写入备注。</p>
    <div class="form">
      <select v-model.number="studentId">
        <option :value="null" disabled>选择学生</option>
        <option v-for="s in store.students.filter((x) => x.active)" :key="s.id" :value="s.id">
          {{ s.name }}
        </option>
      </select>
      <input v-model="fromDay" type="date" />
      <span class="to">至</span>
      <input v-model="toDay" type="date" />
      <input v-model="reason" type="text" placeholder="事由（可选）：感冒发烧" maxlength="60" />
      <button class="btn primary" :disabled="busy" @click="apply">登记</button>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
  </div>

  <!-- 待审批 -->
  <div v-if="pending.length" class="card pad" style="margin-top: 12px">
    <h3 class="sec-title">待审批 <em>{{ pending.length }}</em></h3>
    <div class="list">
      <div v-for="l in pending" :key="l.id" class="item">
        <div class="main">
          <b>{{ l.name }}</b> · {{ l.from_day }} ~ {{ l.to_day }}（{{ daysOf(l) }} 天）
          <span class="reason">{{ l.reason }}</span>
        </div>
        <div class="acts">
          <button class="btn ok" @click="decide(l, true)">批准</button>
          <button class="btn no" @click="decide(l, false)">驳回</button>
          <button class="btn ghost" @click="remove(l)">删除</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 历史 -->
  <div class="card pad" style="margin-top: 12px">
    <h3 class="sec-title">请假记录 <em>{{ decided.length }}</em></h3>
    <div v-if="decided.length" class="list">
      <div v-for="l in decided" :key="l.id" class="item">
        <div class="main">
          <span class="badge" :class="l.status">{{ STATUS_TEXT[l.status] }}</span>
          <b>{{ l.name }}</b> · {{ l.from_day }} ~ {{ l.to_day }}（{{ daysOf(l) }} 天）
          <span class="reason">{{ l.reason }}</span>
          <span v-if="l.decided_by_name" class="by">处理人：{{ l.decided_by_name }}</span>
        </div>
        <div class="acts">
          <button class="btn ghost" @click="remove(l)">删除</button>
        </div>
      </div>
    </div>
    <p v-else class="empty">还没有请假记录</p>
  </div>
</template>

<style scoped>
.card {
  background: var(--panel);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow), var(--glass-inset);
}
.pad {
  padding: 14px 16px;
}
.sec-title {
  margin: 0 0 6px;
  font-size: 14px;
}
.sec-title em {
  color: var(--faint);
  font-style: normal;
  font-size: 12px;
}
.tip {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}
.form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.form select,
.form input {
  font-family: inherit;
  font-size: 13.5px;
  color: var(--text);
  border: 1px solid var(--line);
  background: var(--field);
  padding: 9px 11px;
  border-radius: 10px;
  outline: none;
}
.form select {
  min-width: 110px;
}
.form input[type='date'] {
  width: 130px;
}
.form input[type='text'] {
  flex: 1;
  min-width: 140px;
}
.to {
  color: var(--faint);
  font-size: 12.5px;
}
.btn {
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--line);
  background: var(--field);
  padding: 8px 14px;
  border-radius: 10px;
}
.btn.primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}
.btn.ok {
  color: var(--present);
  border-color: var(--present);
}
.btn.no {
  color: var(--absent);
  border-color: var(--absent);
}
.btn.ghost {
  color: var(--muted);
  font-weight: 600;
}
.err {
  color: var(--absent);
  font-size: 12.5px;
  margin: 8px 0 0;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  flex-wrap: wrap;
}
.main {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.reason {
  color: var(--muted);
  font-size: 12px;
}
.by {
  color: var(--faint);
  font-size: 11.5px;
}
.badge {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
}
.badge.pending {
  background: var(--leave-bg);
  color: var(--leave);
}
.badge.approved {
  background: var(--present-bg);
  color: var(--present);
}
.badge.rejected {
  background: var(--absent-bg);
  color: var(--absent);
}
.acts {
  display: flex;
  gap: 6px;
}
.empty {
  color: var(--faint);
  font-size: 12.5px;
}
</style>
