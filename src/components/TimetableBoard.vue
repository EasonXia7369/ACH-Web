<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import { get, put } from '@/api'
import { saveFile } from '@/utils/platform'
import { useClassStore } from '@/stores/class'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ classId: number }>()
const store = useClassStore()

const WD = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MAX_PERIOD = 12

const weekday = ref(1)
const rows = ref<Array<{ period: number; subject: string; teacher: string }>>(
  Array.from({ length: 8 }, (_, i) => ({ period: i + 1, subject: '', teacher: '' })),
)
const loading = ref(false)
const saving = ref(false)
const toastMsg = ref('')
const loadError = ref('')

function toast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => (toastMsg.value = ''), 2600)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await get<{ timetable: Array<{ weekday: number; period: number; subject: string; teacher: string }> }>(
      `/api/classes/${props.classId}/timetable`,
    )
    applyDay(res.timetable.filter((r) => r.weekday === weekday.value))
  } catch (e: any) {
    loadError.value = e.message ?? '课表加载失败'
    rows.value = Array.from({ length: 8 }, (_, i) => ({ period: i + 1, subject: '', teacher: '' }))
  } finally {
    loading.value = false
  }
}

function applyDay(day: Array<{ period: number; subject: string; teacher: string }>) {
  const maxP = day.reduce((m, r) => Math.max(m, r.period), 8)
  rows.value = Array.from({ length: Math.max(8, Math.min(12, maxP)) }, (_, i) => {
    const hit = day.find((r) => r.period === i + 1)
    return { period: i + 1, subject: hit?.subject ?? '', teacher: hit?.teacher ?? '' }
  })
}

watch([weekday, () => props.classId], load, { immediate: true })

async function save() {
  saving.value = true
  try {
    const periods = rows.value.filter((r) => r.subject.trim())
    await put(`/api/classes/${props.classId}/timetable`, { weekday: weekday.value, periods })
    toast(`周${WD[weekday.value - 1].slice(1)}课表已保存（${periods.length} 节）`)
  } catch (e: any) {
    toast(e.message)
  } finally {
    saving.value = false
  }
}

function addRow() {
  if (rows.value.length < MAX_PERIOD) {
    rows.value.push({ period: rows.value.length + 1, subject: '', teacher: '' })
  }
}

const filledCount = computed(() => rows.value.filter((r) => r.subject.trim()).length)

/* ---------- CSES 课表导入 / 导出 ---------- */
const csesInput = ref<HTMLInputElement | null>(null)
const csesNote = ref('')

interface CsesSchedule {
  name?: string
  enable_day?: number
  weeks?: string
  classes?: Array<{ subject?: string; start_time?: string; end_time?: string }>
}

async function onCsesFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  csesNote.value = ''
  try {
    const doc: any = yamlLoad(await file.text())
    const schedules: CsesSchedule[] = doc?.schedules ?? []
    if (!Array.isArray(schedules) || !schedules.length) {
      csesNote.value = '文件里没有 schedules 段'
      return
    }
    // subjects 段的 teacher 映射
    const teacherMap = new Map<string, string>()
    for (const s of doc?.subjects ?? []) {
      if (s?.name && s?.teacher) teacherMap.set(String(s.name), String(s.teacher))
    }

    // 每个星期取一个 schedule（优先 all；odd/even 跳过并提示）
    const byDay = new Map<number, CsesSchedule>()
    const skippedWeeks: string[] = []
    for (const sch of schedules) {
      const day = Number(sch.enable_day)
      if (!day || day < 1 || day > 7) continue
      const weeks = sch.weeks ?? 'all'
      if (weeks !== 'all') {
        skippedWeeks.push(`${sch.name ?? day}（${weeks === 'odd' ? '单周' : '双周'}）`)
        continue
      }
      if (!byDay.has(day)) byDay.set(day, sch)
    }
    if (!byDay.size) {
      csesNote.value = '没有可导入的课表（全部是单/双周课表，暂不支持）'
      return
    }

    // 按天提交（每天一次 PUT，period = classes 顺序）
    let days = 0
    let periods = 0
    for (const [day, sch] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
      const list = (sch.classes ?? [])
        .filter((cl) => (cl.subject ?? '').trim())
        .slice(0, MAX_PERIOD)
      const payload = list.map((cl, i) => ({
        period: i + 1,
        subject: String(cl.subject).trim().slice(0, 8),
        teacher: (teacherMap.get(String(cl.subject).trim()) ?? '').slice(0, 12),
      }))
      await put(`/api/classes/${props.classId}/timetable`, { weekday: day, periods: payload })
      days++
      periods += payload.length
    }

    let note = `已导入 ${days} 天 / ${periods} 节课程`
    if (skippedWeeks.length) note += `；跳过单双周课表：${skippedWeeks.join('、')}`
    csesNote.value = note
    toast(note)
    if (byDay.has(weekday.value)) load()
  } catch (err: any) {
    csesNote.value = '导入失败：' + (err.message ?? '不是有效的 YAML 文件')
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function exportCses() {
  try {
    const res = await get<{ timetable: Array<{ weekday: number; period: number; subject: string; teacher: string }> }>(
      `/api/classes/${props.classId}/timetable`,
    )
    const rowsAll = res.timetable
    if (!rowsAll.length) {
      csesNote.value = '课表为空，先保存课表再导出'
      return
    }
    const subjects = [...new Set(rowsAll.map((r) => r.subject))].map((name) => {
      const hit = rowsAll.find((r) => r.subject === name && r.teacher)
      return { name, teacher: hit?.teacher ?? undefined }
    })
    // period → 时间：第 1 节 08:00 起，每节 40 分钟 + 10 分钟课间
    const timeOf = (period: number) => {
      const start = 8 * 60 + (period - 1) * 50
      const fmt = (min: number) =>
        `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`
      return { start_time: fmt(start), end_time: fmt(start + 40) }
    }
    const schedules = [1, 2, 3, 4, 5, 6, 7]
      .map((wd) => ({
        name: `星期${'一二三四五六日'[wd - 1]}`,
        enable_day: wd,
        weeks: 'all',
        classes: rowsAll
          .filter((r) => r.weekday === wd)
          .sort((a, b) => a.period - b.period)
          .map((r) => ({ subject: r.subject, ...timeOf(r.period) })),
      }))
      .filter((s) => s.classes.length)

    const doc = { version: 1, subjects, schedules }
    const blob = new Blob(['# 班级中心导出 · CSES v1\n' + yamlDump(doc)], { type: 'text/yaml' })
    await saveFile(`课表_${store.current?.name ?? 'class'}.yaml`, blob)
    csesNote.value = '已导出 CSES YAML（时间按第 1 节 08:00、每节 40 分钟推算）'
  } catch (err: any) {
    csesNote.value = '导出失败：' + (err.message ?? '')
  }
}
</script>

<template>
  <div class="glass pad">
    <div class="daybar">
      <button
        v-for="(d, i) in WD"
        :key="d"
        class="gmini day-btn"
        :class="{ on: weekday === i + 1 }"
        @click="weekday = i + 1"
      >
        {{ d }}
      </button>
      <span class="foot-note" style="margin-left: auto">{{ filledCount }} 节</span>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-if="loadError" class="err" style="margin-bottom: 10px">{{ loadError }}（请确认后端已启动且迁移已应用）</div>
    <div v-else class="rows">
      <div v-for="(r, i) in rows" :key="r.period" class="row">
        <span class="period num">{{ r.period }}</span>
        <input v-model="r.subject" class="ginput" placeholder="科目（留空 = 无课）" maxlength="8" />
        <input v-model="r.teacher" class="ginput" placeholder="任课老师（可选）" maxlength="12" />
        <button v-if="i === rows.length - 1 && rows.length < MAX_PERIOD" class="gmini" @click="addRow">
          ＋节
        </button>
      </div>
    </div>

    <div class="acts">
      <button class="gbtn primary" :disabled="saving" @click="save">
        <Icon name="check" :size="15" /> 保存周{{ WD[weekday - 1].slice(1) }}课表
      </button>
    </div>
    <p class="foot-note" style="margin: 8px 2px 0">
      科目留空即视为无课；保存后大板「今日课程」卡片与周报会同步使用。
    </p>

    <div class="cses-box">
      <h3 class="sec-title">CSES 课表互通</h3>
      <p class="foot-note" style="margin: 0 0 10px">
        支持导入/导出 <b>CSES v1</b> 通用课表格式（.yml/.yaml，兼容 ClassIsland 等软件）。导入会覆盖对应星期的课程；单/双周课表暂不支持，将被跳过。
      </p>
      <input ref="csesInput" type="file" accept=".yml,.yaml" hidden @change="onCsesFile" />
      <div class="acts" style="justify-content: flex-start; margin-top: 0">
        <button class="gbtn" @click="csesInput?.click()"><Icon name="upload" :size="15" /> 导入 CSES 文件</button>
        <button class="gbtn" @click="exportCses"><Icon name="download" :size="15" /> 导出 CSES 文件</button>
      </div>
      <p v-if="csesNote" class="foot-note" style="margin: 8px 0 0">{{ csesNote }}</p>
    </div>
  </div>

  <div v-if="toastMsg" class="gtoast">{{ toastMsg }}</div>
</template>

<style scoped>
.pad {
  padding: 16px 18px;
}
.daybar {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.day-btn.on {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.period {
  width: 30px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--field);
  color: var(--muted);
  font-weight: 600;
  flex: none;
}
.row .ginput:nth-of-type(1) {
  flex: 1;
}
.row .ginput:nth-of-type(2) {
  width: 160px;
  min-width: 96px;
  flex: 1.2;
}
.acts {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}
.cses-box {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--line);
}
</style>
