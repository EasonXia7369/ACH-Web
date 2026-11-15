<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { get } from '@/api'
import { SLOT_LABEL } from '@/utils/dates'

const route = useRoute()
const key = computed(() => String(route.params.key))

const data = ref<any>(null)
const error = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await get<any>(`/api/parent/${key.value}`)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(key, load, { immediate: true })

const STATUS: Record<string, { label: string; cls: string }> = {
  present: { label: '出勤', cls: 'st-present' },
  leave: { label: '请假', cls: 'st-leave' },
  late: { label: '迟到', cls: 'st-late' },
  absent: { label: '旷课', cls: 'st-absent' },
  violate: { label: '违纪', cls: 'st-violate' },
}

const weeklyTotals = computed(() => {
  if (!data.value?.weekly) return { leave: 0, late: 0, absent: 0, violate: 0 }
  return data.value.weekly.reduce(
    (acc: any, w: any) => ({
      leave: acc.leave + w.leave,
      late: acc.late + w.late,
      absent: acc.absent + w.absent,
      violate: acc.violate + w.violate,
    }),
    { leave: 0, late: 0, absent: 0, violate: 0 },
  )
})
</script>

<template>
  <div class="parent-page">
    <header class="head">
      <div class="logo-row">
        <svg width="44" height="44" viewBox="0 0 128 128">
          <defs>
            <linearGradient id="pl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#4f8dff" />
              <stop offset="1" stop-color="#2f49b2" />
            </linearGradient>
          </defs>
          <rect width="128" height="128" rx="30" fill="url(#pl)" />
          <g fill="#fff">
            <path d="M30 74 L98 74 Q96 92 64 94 Q32 92 30 74 Z" opacity=".96" />
            <path d="M60 40 L72 30 V70 H60 Z" opacity=".55" />
          </g>
          <path d="M62 56 L70 64 L86 42" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div>
          <div class="brand">方舟班级中心</div>
          <div class="brand-en">ARK CLASS HUB</div>
        </div>
      </div>
      <h1>{{ data?.class_name ?? '' }}</h1>
      <p class="date-line" v-if="data">{{ data.day }}（{{ dayjs(data.day).format('dddd') }}）家长视图</p>
      <p class="privacy-note">学生姓名已脱敏，仅班主任与家长可对应。本页为只读视图，实时更新。</p>
    </header>

    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>

    <template v-if="data">
      <!-- 今日作业 -->
      <section class="card">
        <h2>今日作业</h2>
        <div v-if="data.homework.length" class="hw-list">
          <div v-for="h in data.homework" :key="h.subject" class="hw-item">
            <span class="subj">{{ h.subject }}</span>
            <span class="content">{{ h.content }}</span>
          </div>
        </div>
        <p v-else class="none">今天没有作业</p>
      </section>

      <!-- 今日课程 -->
      <section class="card">
        <h2>今日课程</h2>
        <div v-if="data.timetable.length" class="tt-grid">
          <div v-for="p in data.timetable" :key="p.period" class="tt-item">
            <span class="tt-p">{{ p.period }}</span>
            <span>{{ p.subject }}</span>
            <span v-if="p.teacher" class="tt-teacher">{{ p.teacher }}</span>
          </div>
        </div>
        <p v-else class="none">今天没有课程</p>
      </section>

      <!-- 今日出勤 -->
      <section class="card">
        <h2>今日出勤</h2>
        <div v-if="data.attendance_today.length" class="att-list">
          <div v-for="(a, i) in data.attendance_today" :key="i" class="att-item" :class="STATUS[a.status]?.cls">
            <span class="att-student">{{ a.student }}</span>
            <span>{{ SLOT_LABEL[a.slot] }}</span>
            <span>{{ STATUS[a.status]?.label }}</span>
            <span v-if="a.note" class="att-note">{{ a.note }}</span>
          </div>
        </div>
        <p v-else class="none">今天全员正常出勤</p>
      </section>

      <!-- 本周汇总 -->
      <section class="card">
        <h2>本周汇总</h2>
        <div v-if="weeklyTotals.leave + weeklyTotals.late + weeklyTotals.absent + weeklyTotals.violate > 0" class="week-grid">
          <div class="week-item"><b class="n-leave">{{ weeklyTotals.leave }}</b><span>请假</span></div>
          <div class="week-item"><b class="n-late">{{ weeklyTotals.late }}</b><span>迟到</span></div>
          <div class="week-item"><b class="n-absent">{{ weeklyTotals.absent }}</b><span>旷课</span></div>
          <div class="week-item"><b class="n-violate">{{ weeklyTotals.violate }}</b><span>违纪</span></div>
        </div>
        <p v-else class="none">本周全勤</p>
      </section>

      <footer class="foot">方舟班级中心 · Ark Class Hub</footer>
    </template>
  </div>
</template>

<style scoped>
.parent-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 20px 64px;
}
.head {
  margin-bottom: 20px;
}
.logo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.brand {
  font-size: 15px;
  font-weight: 600;
}
.brand-en {
  font-size: 10px;
  letter-spacing: 0.3em;
  color: #a1a1a6;
}
h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.date-line {
  margin: 6px 0 0;
  color: #6e6e73;
  font-size: 14px;
}
.privacy-note {
  margin: 10px 0 0;
  font-size: 12px;
  color: #a1a1a6;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  padding: 8px 12px;
}
.card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}
h2 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}
.hw-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hw-item {
  display: flex;
  gap: 12px;
  align-items: baseline;
}
.subj {
  font-weight: 600;
  color: #007aff;
  flex: none;
  width: 56px;
}
.content {
  font-size: 16px;
  line-height: 1.7;
}
.tt-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tt-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f5f5f7;
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 13.5px;
}
.tt-p {
  background: #007aff;
  color: #fff;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
}
.tt-teacher {
  color: #86868b;
  font-size: 12px;
}
.att-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.att-item {
  display: flex;
  gap: 12px;
  font-size: 13.5px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #f5f5f7;
  flex-wrap: wrap;
}
.att-student {
  font-weight: 600;
}
.st-present {
  color: #34c759;
}
.st-leave {
  color: #ff9500;
}
.st-late {
  color: #007aff;
}
.st-absent {
  color: #ff3b30;
}
.st-violate {
  color: #af52de;
}
.att-note {
  color: #86868b;
  font-size: 12px;
}
.week-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.week-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f5f5f7;
  border-radius: 12px;
  padding: 12px 6px;
}
.week-item b {
  font-size: 24px;
  font-weight: 600;
}
.week-item span {
  font-size: 11.5px;
  color: #6e6e73;
}
.n-leave {
  color: #ff9500;
}
.n-late {
  color: #007aff;
}
.n-absent {
  color: #ff3b30;
}
.n-violate {
  color: #af52de;
}
.none {
  color: #a1a1a6;
  font-size: 13px;
  margin: 4px 0 0;
}
.state {
  text-align: center;
  padding: 48px 0;
  color: #6e6e73;
}
.err {
  color: #ff3b30;
}
.foot {
  text-align: center;
  color: #a1a1a6;
  font-size: 12px;
  margin-top: 20px;
}
</style>
