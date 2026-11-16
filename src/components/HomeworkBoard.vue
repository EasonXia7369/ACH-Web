<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { get, put, del } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useClassStore } from '@/stores/class'
import { useChatStore } from '@/stores/chat'
import { exportXlsx } from '@/utils/xlsx'
import { dk, weekdayCn } from '@/utils/dates'
import { initialOf } from '@/utils/pinyin'

const props = defineProps<{ classId: number }>()
const store = useClassStore()
const chat = useChatStore()
const auth = useAuthStore()

const isStudent = computed(() => auth.user?.role === 'student')

const sub = ref<'miss' | 'task'>('miss')

/* ---------- 作业未交 ---------- */
const day = ref(dk())
const subject = ref('')
const title = ref('')
const missing = ref<Set<number>>(new Set())
const rangeFrom = ref(dayjs().startOf('month').format('YYYY-MM-DD'))
const rangeTo = ref(dk())
const rangeRecords = ref<any[]>([])
const rangeTasks = ref<any[]>([])

const subjects = computed(() => store.current?.subjects ?? [])

const todayRecords = computed(() =>
  rangeRecords.value.filter((r) => r.day === day.value && !r.deleted),
)

const todayTask = computed(() =>
  rangeTasks.value.find((t) => t.day === day.value && t.subject === subject.value),
)

const surnameBar = computed(() => {
  const map = new Map<string, number>()
  for (const s of store.students.filter((x) => x.active)) {
    const k = initialOf(s)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})
const surname = ref('')

const filteredStudents = computed(() =>
  store.students
    .filter((s) => s.active)
    .filter((s) => !surname.value || initialOf(s) === surname.value),
)

async function loadRange() {
  const [rec, task] = await Promise.all([
    get<any>(`/api/classes/${props.classId}/hw-records?from=${rangeFrom.value}&to=${rangeTo.value}`),
    get<any>(`/api/classes/${props.classId}/hw-tasks?from=${rangeFrom.value}&to=${rangeTo.value}`),
  ])
  rangeRecords.value = rec.records
  rangeTasks.value = task.tasks
}

watch([rangeFrom, rangeTo, props.classId], loadRange, { immediate: true })
// 其他端变更作业 → 自动刷新
watch(() => chat.refreshTick, () => loadRange())

watch(day, () => {
  // 换天时载入当天已有记录到勾选状态
  missing.value = new Set(
    todayRecords.value.find((r) => r.subject === subject.value)?.missing ?? [],
  )
  const first = todayRecords.value.find((r) => r.subject === subject.value)
  title.value = first?.title ?? ''
})

watch(subject, () => {
  const rec = todayRecords.value.find((r) => r.subject === subject.value)
  missing.value = new Set(rec?.missing ?? [])
  title.value = rec?.title ?? ''
})

function toggle(sid: number) {
  const next = new Set(missing.value)
  if (next.has(sid)) next.delete(sid)
  else next.add(sid)
  missing.value = next
}

async function saveMiss() {
  if (!subject.value.trim()) {
    alert('请先选科目')
    return
  }
  await put(`/api/classes/${props.classId}/hw-records`, {
    day: day.value,
    subject: subject.value.trim(),
    title: title.value.trim(),
    missing: [...missing.value],
  })
  await loadRange()
}

async function markAllPresent() {
  missing.value = new Set()
  await saveMiss()
}

async function deleteToday() {
  if (!subject.value.trim()) return
  if (!confirm(`删除 ${day.value} ${subject.value} 的作业记录？`)) return
  await del(
    `/api/classes/${props.classId}/hw-records?day=${day.value}&subject=${encodeURIComponent(subject.value.trim())}`,
  )
  missing.value = new Set()
  title.value = ''
  await loadRange()
}

/* ---------- 统计 ---------- */
const perStudent = computed(() => {
  const counts = new Map<number, { name: string; count: number; detail: string[] }>()
  for (const s of store.students.filter((x) => x.active)) {
    counts.set(s.id, { name: s.name, count: 0, detail: [] })
  }
  for (const r of rangeRecords.value) {
    if (r.deleted) continue
    for (const sid of r.missing) {
      const entry = counts.get(sid)
      if (!entry) continue
      entry.count++
      const t = r.title ? `（${r.title}）` : ''
      entry.detail.push(`${r.day} ${r.subject}${t}`)
    }
  }
  return [...counts.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
})

async function exportMiss() {
  const rows = perStudent.value.map((s, i) => [
    { v: i + 1 },
    { v: s.name },
    { v: s.count },
    { v: s.detail.join('；') },
  ])
  const listRows = rangeRecords.value
    .filter((r) => !r.deleted)
    .map((r) => [
      { v: r.day },
      { v: weekdayCn(r.day) },
      { v: r.subject },
      { v: r.title || '' },
      { v: r.missing.map((id: number) => store.students.find((s) => s.id === id)?.name ?? id).join('、') },
    ])
  await exportXlsx(`作业统计_${store.current?.name}_${rangeFrom.value}至${rangeTo.value}.xlsx`, [
    {
      name: '作业汇总',
      header: ['序号', '姓名', '未交次数', '未交明细'],
      rows,
      widths: [6, 12, 10, 60],
      freeze: 1,
    },
    {
      name: '作业明细',
      header: ['日期', '星期', '科目', '作业内容', '未交学生'],
      rows: listRows,
      widths: [12, 8, 10, 40, 40],
      freeze: 1,
    },
  ])
}

/* ---------- 作业布置 ---------- */
const taskDay = ref(dk())
const taskSubject = ref('')
const taskContent = ref('')

const dayTasks = computed(() => rangeTasks.value.filter((t) => t.day === taskDay.value))

watch(taskSubject, () => {
  taskContent.value = dayTasks.value.find((t) => t.subject === taskSubject.value)?.content ?? ''
})

watch(taskDay, () => {
  taskContent.value = dayTasks.value.find((t) => t.subject === taskSubject.value)?.content ?? ''
})

async function saveTask() {
  if (!taskSubject.value.trim()) {
    alert('请先选科目')
    return
  }
  await put(`/api/classes/${props.classId}/hw-tasks`, {
    day: taskDay.value,
    subject: taskSubject.value.trim(),
    content: taskContent.value,
  })
  await loadRange()
}

/* ---------- 区间作业记录（回填 / 删除） ---------- */
const missNames = (missing: number[]) =>
  missing.map((id) => store.students.find((s) => s.id === id)?.name ?? `#${id}`).join('、') || '无'

async function loadMiss(r: any) {
  sub.value = 'miss'
  day.value = r.day
  subject.value = r.subject
  title.value = r.title
  missing.value = new Set(r.missing)
}

async function deleteMiss(r: any) {
  if (!confirm(`删除 ${r.day} ${r.subject} 的作业记录？`)) return
  await del(
    `/api/classes/${props.classId}/hw-records?day=${r.day}&subject=${encodeURIComponent(r.subject)}`,
  )
  await loadRange()
}

function loadTask(t: any) {
  taskDay.value = t.day
  taskSubject.value = t.subject
  taskContent.value = t.content
}
</script>

<template>
  <div class="subbar">
    <button :class="{ on: sub === 'miss' }" @click="sub = 'miss'">作业未交</button>
    <button :class="{ on: sub === 'task' }" @click="sub = 'task'">作业布置</button>
  </div>

  <!-- ======== 作业未交 ======== -->
  <template v-if="sub === 'miss'">
    <div class="card toolbar">
      <input v-model="day" type="date" />
      <select v-model="subject" class="subject-sel">
        <option value="" disabled>科目</option>
        <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
      </select>
      <input v-model="title" type="text" class="title-in" placeholder="作业内容（可选）：第3章练习册 P32" maxlength="40" />
    </div>

    <div class="surname">
      <button :class="{ on: !surname }" @click="surname = ''">全部</button>
      <button
        v-for="[letter, count] in surnameBar"
        :key="letter"
        :class="{ on: surname === letter }"
        @click="surname = surname === letter ? '' : letter"
      >
        <b>{{ letter }}</b><small>{{ count }}</small>
      </button>
    </div>

    <div class="card pad">
      <div class="sgrid">
        <button
          v-for="s in filteredStudents"
          :key="s.id"
          class="stu"
          :class="{ miss: missing.has(s.id) }"
          @click="toggle(s.id)"
        >
          {{ s.name }}
        </button>
      </div>
    </div>
    <p class="foot-note">
      已选 {{ missing.size }} 人未交。点姓名切换状态，
      <a class="lnk" @click="markAllPresent">一键全部交齐</a> ·
      <a class="lnk danger" @click="deleteToday">删除本次</a>
      <button class="btn primary save-btn" @click="saveMiss">保存</button>
    </p>

    <div class="card toolbar" style="margin-top: 14px">
      <input v-model="rangeFrom" type="date" />
      <span class="to">至</span>
      <input v-model="rangeTo" type="date" />
      <button class="mini" @click="rangeFrom = dayjs().startOf('month').format('YYYY-MM-DD'); rangeTo = dk()">本月</button>
      <button class="mini" @click="rangeFrom = dk(dayjs().subtract(6, 'day')); rangeTo = dk()">近7天</button>
      <button class="mini" @click="exportMiss">导出</button>
    </div>

    <div class="card tablecard">
      <div class="table-scroll">
      <table class="stats">
        <thead>
          <tr><th style="width: 30px">#</th><th style="width: 88px">姓名</th><th>未交次数</th><th style="text-align: left; padding-left: 10px">未交明细</th></tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in perStudent" :key="s.id">
            <td class="idx">{{ i + 1 }}</td>
            <td class="name">{{ s.name }}</td>
            <td :class="{ nz: s.count }">{{ s.count || '' }}</td>
            <td class="vio">{{ s.detail.join('；') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div class="card pad" style="margin-top: 12px">
      <h3 class="sec-title">区间作业记录 <em>{{ rangeRecords.filter((r) => !r.deleted).length }}</em></h3>
      <div v-if="rangeRecords.filter((r) => !r.deleted).length" class="rec-list">
        <div v-for="r in rangeRecords.filter((x) => !x.deleted)" :key="r.day + r.subject" class="rec-row">
          <div class="rec-main">
            <b class="num">{{ r.day }}</b> · <b>{{ r.subject }}</b>
            <span v-if="r.title" class="rec-title">{{ r.title }}</span>
            <span class="rec-missing">未交：{{ missNames(r.missing) }}</span>
          </div>
          <div class="rec-acts">
            <button class="gmini" @click="loadMiss(r)">载入</button>
            <button v-if="!isStudent" class="gmini danger" @click="deleteMiss(r)">删除</button>
          </div>
        </div>
      </div>
      <p v-else class="empty">该区间没有作业记录</p>
    </div>
  </template>

  <!-- ======== 作业布置（学生为只读视图） ======== -->
  <template v-else>
    <div class="card toolbar">
      <input v-model="taskDay" type="date" />
      <button class="mini" @click="taskDay = dk()">今天</button>
    </div>

    <div class="card pad">
      <div class="surname" style="padding-top: 0">
        <button
          v-for="s in subjects"
          :key="s"
          :class="{ on: taskSubject === s }"
          @click="taskSubject = s"
        >
          {{ s }}
        </button>
      </div>
      <textarea
        v-model="taskContent"
        placeholder="选择科目，填写当天作业内容，如：《练习册》P32 第1-8题…"
        maxlength="300"
      ></textarea>
      <div class="task-acts">
        <button class="btn primary" style="flex: 1" @click="saveTask">保存本科目作业</button>
        <button class="mini danger" @click="taskContent = ''; saveTask()">清空本科目</button>
      </div>
    </div>
    <p class="foot-note">按日期 × 科目保存；内容清空后保存即删除该科作业。值日生可代老师布置，操作记为「学生」。</p>

    <div class="card" style="margin-top: 12px">
      <div class="pad">
        <h3 class="sec-title">当日作业一览 <em>{{ dayTasks.length }}</em></h3>
        <div v-if="dayTasks.length" class="daylist">
          <div v-for="t in dayTasks" :key="t.subject" class="dayitem">
            <b>{{ t.subject }}</b>：{{ t.content }}
          </div>
        </div>
        <p v-else class="empty">当天还没有布置作业</p>
      </div>
    </div>

    <div class="card pad" style="margin-top: 12px">
      <h3 class="sec-title">区间作业记录 <em>{{ rangeTasks.length }}</em></h3>
      <div v-if="rangeTasks.length" class="rec-list">
        <div v-for="t in rangeTasks" :key="t.day + t.subject" class="rec-row">
          <div class="rec-main">
            <b class="num">{{ t.day }}</b> · <b>{{ t.subject }}</b>：{{ t.content }}
          </div>
          <div class="rec-acts">
            <button v-if="!isStudent" class="gmini" @click="loadTask(t)">载入修改</button>
          </div>
        </div>
      </div>
      <p v-else class="empty">该区间没有布置过作业</p>
    </div>
  </template>
</template>

<style scoped>
.subbar {
  display: inline-flex;
  background: var(--field);
  padding: 3px;
  border-radius: 10px;
  gap: 2px;
  margin-bottom: 10px;
}
.subbar button {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--muted);
  border: none;
  background: none;
  cursor: pointer;
}
.subbar button.on {
  background: var(--field);
  color: var(--primary);
}
.card {
  background: var(--panel);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow), var(--glass-inset);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.toolbar input[type='date'] {
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  border: 1px solid var(--line);
  background: var(--field);
  padding: 9px 11px;
  border-radius: 10px;
  outline: none;
}
.subject-sel {
  width: 104px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  border: 1px solid var(--line);
  background: var(--field);
  padding: 9px 11px;
  border-radius: 10px;
  outline: none;
  flex: none;
}
.title-in {
  flex: 1;
  min-width: 150px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  border: 1px solid var(--line);
  background: var(--field);
  padding: 9px 11px;
  border-radius: 10px;
  outline: none;
}
.mini {
  padding: 7px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--field);
  font-size: 12.5px;
  color: var(--muted);
  cursor: pointer;
}
.mini.danger {
  color: var(--absent);
}
.surname {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 2px 8px;
  scrollbar-width: none;
}
.surname::-webkit-scrollbar {
  display: none;
}
.surname button {
  flex: none;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--field);
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  font-weight: 600;
}
.surname button b {
  color: var(--text);
}
.surname button small {
  font-size: 10.5px;
  color: var(--faint);
  margin-left: 2px;
}
.surname button.on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}
.surname button.on b,
.surname button.on small {
  color: var(--on-primary);
}
.pad {
  padding: 14px 16px;
}
.sgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}
.stu {
  padding: 10px 6px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--field);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: 0.12s;
}
.stu.miss {
  background: var(--absent-bg);
  border-color: var(--absent);
  color: var(--absent);
}
.stu:active {
  transform: scale(0.95);
}
.foot-note {
  color: var(--faint);
  font-size: 12px;
  margin: 10px 2px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lnk {
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
}
.lnk.danger {
  color: var(--absent);
}
.save-btn {
  padding: 7px 18px;
  margin-left: auto;
}
.btn {
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--line);
  background: var(--field);
  padding: 9px 14px;
  border-radius: 10px;
  font-weight: 700;
  color: var(--text);
}
.btn.primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}
.to {
  color: var(--faint);
  font-size: 12.5px;
}
.tablecard {
  overflow: hidden;
}
.stats {
  width: 100%;
  border-collapse: collapse;
}
.stats th {
  background: var(--field);
  color: var(--muted);
  font-size: 12px;
  padding: 8px 6px;
  border-bottom: 1px solid var(--line);
  text-align: center;
}
.stats td {
  padding: 6px;
  border-bottom: 1px solid var(--line-soft);
  text-align: center;
  font-size: 13px;
}
.stats td.idx {
  color: var(--faint);
  font-size: 12px;
}
.stats td.name {
  text-align: left;
  font-weight: 600;
}
.stats td.nz {
  font-weight: 700;
  color: var(--absent);
}
.stats td.vio {
  text-align: left;
  padding-left: 10px;
  color: var(--muted);
  font-size: 12px;
}
textarea {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px;
  outline: none;
  box-sizing: border-box;
}
.task-acts {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  align-items: center;
}
.sec-title {
  margin: 0 0 8px;
  font-size: 14px;
}
.sec-title em {
  color: var(--faint);
  font-style: normal;
  font-size: 12px;
}
.daylist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dayitem {
  font-size: 13px;
  padding: 8px 10px;
  background: var(--primary-soft);
  border-radius: 8px;
}
.empty {
  color: var(--faint);
  font-size: 12.5px;
}
.rec-list {
  display: flex;
  flex-direction: column;
}
.rec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px solid var(--line-soft);
  flex-wrap: wrap;
}
.rec-main {
  font-size: 13px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 200px;
}
.rec-title {
  color: var(--muted);
  font-size: 12px;
}
.rec-missing {
  color: var(--absent);
  font-size: 12px;
}
.rec-acts {
  display: flex;
  gap: 6px;
  flex: none;
}
</style>
