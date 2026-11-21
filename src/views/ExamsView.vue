<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { get, post, put, del } from '@/api'
import { useClassStore } from '@/stores/class'
import { useAi } from '@/composables/useAi'
import Icon from '@/components/Icon.vue'

const store = useClassStore()
const { aiEnabled, ensureStatus } = useAi()
ensureStatus()

/* ---------- 视图状态 ---------- */
const view = ref<'list' | 'exam'>('list')
const exams = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const toastMsg = ref('')
function toast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => (toastMsg.value = ''), 2400)
}

const classSubjects = computed<string[]>(() => {
  const raw = (store.current as any)?.subjects_json ?? (store.current as any)?.subjects
  if (Array.isArray(raw)) return raw.map((s: any) => String(s))
  try {
    return JSON.parse(raw ?? '[]')
  } catch {
    return []
  }
})

async function loadExams() {
  if (!store.current) return
  loading.value = true
  error.value = ''
  try {
    const res = await get<{ exams: any[] }>(`/api/classes/${store.current.id}/exams`)
    exams.value = res.exams
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(
  () => store.current?.id,
  () => {
    view.value = 'list'
    loadExams()
  },
  { immediate: true },
)

/* ---------- 新建考试 ---------- */
const showNew = ref(false)
const newName = ref('')
const newDay = ref(new Date().toISOString().slice(0, 10))
const newSubs = ref<Array<{ subject: string; full: number }>>([])
const creating = ref(false)

function openNew() {
  newSubs.value = (classSubjects.value.length ? classSubjects.value : ['语文', '数学', '英语']).map(
    (s) => ({ subject: s, full: 100 }),
  )
  newName.value = ''
  showNew.value = true
}

async function createExam() {
  if (!store.current || creating.value) return
  creating.value = true
  error.value = ''
  try {
    const res = await post<{ exam: any }>(`/api/classes/${store.current.id}/exams`, {
      name: newName.value.trim(),
      day: newDay.value,
      subjects: newSubs.value,
    })
    showNew.value = false
    toast('考试已创建')
    await loadExams()
    openExam(res.exam.id)
  } catch (e: any) {
    error.value = e.message
  } finally {
    creating.value = false
  }
}

async function removeExam(e: any) {
  if (!confirm(`删除考试「${e.name}」及其全部成绩？`)) return
  try {
    await del(`/api/classes/${store.current!.id}/exams/${e.id}`)
    toast('已删除')
    loadExams()
  } catch (err: any) {
    error.value = err.message
  }
}

/* ---------- 考试详情 ---------- */
const exam = ref<any>(null)
const students = ref<any[]>([])
const stats = ref<Record<string, any>>({})
const loadingExam = ref(false)

async function openExam(id: number) {
  view.value = 'exam'
  loadingExam.value = true
  error.value = ''
  try {
    const res = await get<any>(`/api/classes/${store.current!.id}/exams/${id}`)
    exam.value = res.exam
    students.value = res.students
    stats.value = res.stats
    exitEdit()
    loadTrends()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loadingExam.value = false
  }
}

/* ---------- 录分（矩阵编辑） ---------- */
const editing = ref(false)
const draft = ref<Record<string, string>>({}) // `${studentId}|${subject}` -> 输入框内容
const saving = ref(false)

function startEdit() {
  const d: Record<string, string> = {}
  for (const s of students.value) {
    for (const sub of exam.value.subjects) {
      const v = s.scores[sub.subject]
      d[`${s.id}|${sub.subject}`] = v === null || v === undefined ? '' : String(v)
    }
  }
  draft.value = d
  editing.value = true
}

function exitEdit() {
  editing.value = false
  draft.value = {}
}

/** Excel 单列粘贴：从当前单元格向下填充同科分数 */
function onPaste(e: ClipboardEvent, studentId: number, subject: string) {
  const text = e.clipboardData?.getData('text') ?? ''
  if (!text || (!text.includes('\n') && !text.includes('\t'))) return
  e.preventDefault()
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
  const idx = students.value.findIndex((s) => s.id === studentId)
  let r = idx
  for (const line of lines) {
    if (r >= students.value.length) break
    const cell = line.includes('\t') ? (line.split('\t').pop() ?? '').trim() : line.trim()
    draft.value[`${students.value[r].id}|${subject}`] = cell
    r++
  }
  toast(`已粘贴 ${Math.min(lines.length, students.value.length - idx)} 行，请核对后保存`)
}

async function saveScores() {
  if (!store.current || !exam.value || saving.value) return
  const scores: Array<{ student_id: number; subject: string; score: number | null }> = []
  for (const s of students.value) {
    for (const sub of exam.value.subjects) {
      const raw = (draft.value[`${s.id}|${sub.subject}`] ?? '').trim()
      if (raw === '') {
        scores.push({ student_id: s.id, subject: sub.subject, score: null })
      } else {
        const v = Number(raw)
        scores.push({ student_id: s.id, subject: sub.subject, score: v })
      }
    }
  }
  saving.value = true
  error.value = ''
  try {
    await put(`/api/classes/${store.current!.id}/exams/${exam.value.id}/scores`, { scores })
    toast('成绩已保存')
    editing.value = false
    await openExam(exam.value.id)
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

/* ---------- 趋势（SVG 折线） ---------- */
const trends = ref<{ series: any[]; students: any[] } | null>(null)
const trendSub = ref('')
const trendStudentId = ref<number | null>(null)

async function loadTrends() {
  try {
    const res = await get<any>(`/api/classes/${store.current!.id}/exams/trends`)
    trends.value = res
    const subs = exam.value?.subjects ?? []
    if (subs.length && !res.series.some((s: any) => s.subjectAvgs[subs[0].subject] !== null)) {
      trendSub.value = ''
    }
    trendSub.value = subs[0]?.subject ?? ''
  } catch {
    trends.value = null
  }
}

const trendPoints = computed(() => {
  if (!trends.value || !exam.value) return null
  const sub = trendSub.value || exam.value.subjects[0]?.subject
  if (!sub) return null
  const pts = trends.value.series
    .map((s: any) => ({ label: s.name, day: s.day, v: s.subjectAvgs[sub] }))
    .filter((p: any) => p.v !== null)
  if (pts.length < 2) return null
  const stuPts =
    trendStudentId.value !== null
      ? (trends.value.students.find((s: any) => s.id === trendStudentId.value)?.exams ?? [])
          .map((e: any) => ({ label: e.name, v: e.scores[sub] }))
          .filter((p: any) => p.v !== null)
      : []
  const all = [...pts.map((p: any) => p.v), ...stuPts.map((p: any) => p.v)]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const W = 560
  const H = 150
  const x = (i: number, len: number) => 36 + (i * (W - 60)) / Math.max(1, len - 1)
  const y = (v: number) => H - 24 - ((v - min) / span) * (H - 48)
  const toLine = (arr: any[]) => arr.map((p: any, i: number) => `${x(i, arr.length)},${y(p.v)}`).join(' ')
  return {
    W,
    H,
    cls: toLine(pts),
    clsPts: pts,
    stu: stuPts.length >= 2 ? toLine(stuPts) : null,
    stuPts,
    labels: pts.map((p: any) => p.label),
    y,
    x,
  }
})

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1)

/* ---------- AI 考试总结（结构化分块） ---------- */
const aiSummary = ref<any>(null)
const aiSumBusy = ref(false)
const aiSumError = ref('')

async function genSummary() {
  if (aiSumBusy.value || !exam.value) return
  aiSumBusy.value = true
  aiSumError.value = ''
  aiSummary.value = null
  try {
    const res = await post<{ summary: any }>(`/api/classes/${store.current!.id}/exams/${exam.value.id}/summary`, {})
    aiSummary.value = res.summary
  } catch (e: any) {
    aiSumError.value = e.message
  } finally {
    aiSumBusy.value = false
  }
}

/* ---------- AI 个人点评（全班一键 / 单条；评语存库可编辑） ---------- */
const showComments = ref(false)
const comments = ref<Record<number, { text: string; updated_at: string; busy?: boolean; error?: string }>>({})
const commentsLoading = ref(false)
const genAllBusy = ref(false)
const genAllProgress = ref(0)
const genAllTotal = ref(0)
const editingSid = ref<number | null>(null)
const editText = ref('')

async function openComments() {
  showComments.value = true
  commentsLoading.value = true
  try {
    const res = await get<{ comments: any[] }>(`/api/classes/${store.current!.id}/exams/${exam.value!.id}/comments`)
    const map: Record<number, { text: string; updated_at: string }> = {}
    for (const c of res.comments) map[c.student_id] = { text: c.text, updated_at: c.updated_at }
    comments.value = map
  } catch (e: any) {
    error.value = e.message
  } finally {
    commentsLoading.value = false
  }
}

async function genOneComment(sid: number) {
  const entry = comments.value[sid]
  if (entry?.busy) return
  comments.value[sid] = { text: entry?.text ?? '', updated_at: entry?.updated_at ?? '', busy: true }
  try {
    const res = await post<{ comment: { text: string; updated_at: string } }>(
      `/api/classes/${store.current!.id}/exams/${exam.value!.id}/comments`,
      { student_id: sid },
    )
    comments.value[sid] = { text: res.comment.text, updated_at: res.comment.updated_at }
  } catch (e: any) {
    comments.value[sid] = { text: entry?.text ?? '', updated_at: entry?.updated_at ?? '', error: e.message }
  }
}

/** 全班一键：并发 3 个逐生生成，进度条可见；失败的可单独重试 */
async function genAllComments() {
  if (genAllBusy.value) return
  const targets = students.value.filter((s) => s.active)
  genAllBusy.value = true
  genAllTotal.value = targets.length
  genAllProgress.value = 0
  let done = 0
  const queue = [...targets]
  const worker = async () => {
    while (queue.length) {
      const s = queue.shift()!
      const prev = comments.value[s.id]
      comments.value[s.id] = { text: prev?.text ?? '', updated_at: prev?.updated_at ?? '', busy: true }
      try {
        const res = await post<{ comment: { text: string; updated_at: string } }>(
          `/api/classes/${store.current!.id}/exams/${exam.value!.id}/comments`,
          { student_id: s.id },
        )
        comments.value[s.id] = { text: res.comment.text, updated_at: res.comment.updated_at }
      } catch (e: any) {
        comments.value[s.id] = { text: prev?.text ?? '', updated_at: prev?.updated_at ?? '', error: e.message }
      }
      done++
      genAllProgress.value = done
    }
  }
  await Promise.all([worker(), worker(), worker()])
  genAllBusy.value = false
  toast(`已生成 ${genAllProgress.value} 条评语，失败的可单独重试`)
}

function startEditComment(sid: number) {
  editingSid.value = sid
  editText.value = comments.value[sid]?.text ?? ''
}

async function saveComment(sid: number) {
  try {
    const res = await put<{ comment: { text: string; updated_at: string } }>(
      `/api/classes/${store.current!.id}/exams/${exam.value!.id}/comments/${sid}`,
      { text: editText.value },
    )
    comments.value[sid] = { text: res.comment.text, updated_at: res.comment.updated_at }
    editingSid.value = null
    toast('评语已保存')
  } catch (e: any) {
    error.value = e.message
  }
}

async function copyComment(sid: number) {
  try {
    const name = students.value.find((s) => s.id === sid)?.name ?? ''
    await navigator.clipboard.writeText(comments.value[sid]?.text ?? '')
    toast(`已复制 ${name} 的评语`)
  } catch {
    toast('复制失败，请手动选择文本')
  }
}

/* ---------- 智能导入（AI 解析 → 预览确认 → 写入） ---------- */
const showImport = ref(false)
const importText = ref('')
const importBusy = ref(false)
const importError = ref('')
const parsed = ref<any>(null) // {subjects, rows}
const fileInput = ref<HTMLInputElement | null>(null)

function openImport() {
  showImport.value = true
  importText.value = ''
  parsed.value = null
  importError.value = ''
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    let text = ''
    if (/\.csv$|\.txt$/i.test(file.name)) {
      text = (await file.text()).replace(/^\uFEFF/, '')
    } else {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.worksheets[0]
      const lines: string[] = []
      ws.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = []
        row.eachCell({ includeEmpty: false }, (cell) => {
          const v = cell.value
          cells.push(v === null || v === undefined ? '' : String(typeof v === 'object' && 'text' in (v as any) ? (v as any).text : v).trim())
        })
        while (cells.length && !cells[cells.length - 1]) cells.pop()
        if (cells.length) lines.push(cells.join('\t'))
      })
      text = lines.join('\n')
    }
    importText.value = text
  } catch (err: any) {
    importError.value = '文件读取失败：' + (err.message ?? '未知错误')
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function parseImport() {
  if (!importText.value.trim() || importBusy.value) return
  importBusy.value = true
  importError.value = ''
  try {
    const res = await post<any>(`/api/classes/${store.current!.id}/exams/${exam.value!.id}/import-parse`, {
      text: importText.value,
    })
    parsed.value = res
    toast(`解析完成：${res.total_matched}/${res.rows.length} 人自动匹配`)
  } catch (e: any) {
    importError.value = e.message
  } finally {
    importBusy.value = false
  }
}

/** 预览里指认学生 */
function assignStudent(row: any, sid: number | null) {
  row.student_id = sid
  row.matched = sid !== null
}

async function confirmImport() {
  if (!parsed.value || !exam.value) return
  // 合并：解析行覆盖对应学生对应科目（未匹配行跳过、科目限本场考试）
  const subjectSet = new Set(exam.value.subjects.map((s: any) => s.subject))
  const scores: Array<{ student_id: number; subject: string; score: number | null }> = []
  for (const sub of exam.value.subjects) {
    for (const s of students.value) {
      const cur = s.scores[sub.subject]
      scores.push({ student_id: s.id, subject: sub.subject, score: cur === null || cur === undefined ? null : cur })
    }
  }
  let written = 0
  for (const row of parsed.value.rows) {
    if (!row.matched || !row.student_id) continue
    for (const [sub, v] of Object.entries(row.scores)) {
      if (!subjectSet.has(sub)) continue
      if (v === null || v === undefined) continue
      const num = Number(v)
      if (!Number.isFinite(num)) continue
      const target = scores.find((x) => x.student_id === row.student_id && x.subject === sub)
      if (target) {
        target.score = num
        written++
      }
    }
  }
  saving.value = true
  error.value = ''
  try {
    await put(`/api/classes/${store.current!.id}/exams/${exam.value.id}/scores`, { scores })
    toast(`导入完成，写入 ${written} 个分数`)
    showImport.value = false
    await openExam(exam.value.id)
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- 列表 -->
  <div v-if="view === 'list'" class="glass pad">
    <div class="head-row">
      <h2 class="sec-title" style="margin: 0">考试成绩</h2>
      <button class="gbtn primary" @click="openNew"><Icon name="plus" :size="15" /> 新建考试</button>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading" class="empty" style="padding: 16px 0">加载中…</p>
    <p v-else-if="!exams.length" class="empty" style="padding: 24px 0; text-align: center">
      还没有考试。新建一场考试，录入或用智能导入成绩。
    </p>
    <div v-else class="exam-list">
      <button v-for="e in exams" :key="e.id" class="exam-item" @click="openExam(e.id)">
        <span class="ico-tile" style="--tile-color: var(--tile-exam)">
          <Icon name="exam" :size="20" />
        </span>
        <span class="exam-meta">
          <b>{{ e.name }}</b>
          <span class="hint">{{ e.day }} · {{ e.subjects.map((s: any) => s.subject).join(' / ') }}</span>
        </span>
        <span class="gmini" @click.stop="removeExam(e)" @keydown.stop>删除</span>
      </button>
    </div>
    <p class="foot-note" style="margin-top: 10px">
      成绩仅教师可见；家长凭学号绑定后在「家长视图」查看自己孩子的分数与趋势（不含排名）。教室大板不显示成绩。
    </p>
  </div>

  <!-- 新建弹窗 -->
  <Teleport to="body">
    <div v-if="showNew" class="gbackdrop" @click.self="showNew = false">
      <div class="gpop" style="width: min(480px, 94vw)">
        <h3 class="sec-title">新建考试</h3>
        <div class="row">
          <div style="flex: 2; min-width: 0">
            <label class="flabel">考试名称</label>
            <input v-model="newName" class="ginput" style="width: 100%" placeholder="如：11月月考" maxlength="40" />
          </div>
          <div style="flex: 1; min-width: 0">
            <label class="flabel">日期</label>
            <input v-model="newDay" type="date" class="ginput" style="width: 100%" />
          </div>
        </div>
        <label class="flabel">科目与满分（及格 = 满分×60%，优秀 = ×85%）</label>
        <div class="sub-row" v-for="(s, i) in newSubs" :key="i">
          <input v-model="s.subject" class="ginput" style="flex: 1" placeholder="科目" maxlength="16" />
          <input v-model.number="s.full" type="number" class="ginput" style="width: 90px" min="1" max="1000" />
          <button class="gmini danger" @click="newSubs.splice(i, 1)">删</button>
        </div>
        <div class="row">
          <button class="gmini" @click="newSubs.push({ subject: '', full: 100 })"><Icon name="plus" :size="13" /> 加科目</button>
          <span class="foot-note">满分默认 100，可改 150 / 300 等</span>
        </div>
        <p v-if="error" class="err">{{ error }}</p>
        <div class="import-acts">
          <button class="gbtn" @click="showNew = false">取消</button>
          <button class="gbtn primary" :disabled="creating || !newName.trim() || !newSubs.length" @click="createExam">
            创建并录分
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 详情 / 录分 -->
  <div v-if="view === 'exam'" class="glass pad">
    <div class="head-row">
      <button class="gbtn icon" title="返回列表" @click="view = 'list'"><Icon name="chevronLeft" :size="16" /></button>
      <div style="min-width: 0">
        <h2 class="sec-title" style="margin: 0">{{ exam?.name }}</h2>
        <span class="hint">{{ exam?.day }} · 满分 {{ exam?.subjects.map((s: any) => s.subject + ' ' + s.full).join(' / ') }}</span>
      </div>
      <template v-if="!editing">
        <template v-if="aiEnabled">
          <button class="gbtn ai-act" :disabled="aiSumBusy" @click="genSummary">
            <Icon name="quote" :size="15" /> {{ aiSumBusy ? '总结生成中…' : 'AI 总结' }}
          </button>
          <button class="gbtn ai-act" @click="openComments"><Icon name="users" :size="15" /> AI 点评</button>
          <button class="gbtn ai-act" @click="openImport"><Icon name="upload" :size="15" /> 智能导入</button>
        </template>
        <button class="gbtn primary" style="margin-left: auto" @click="startEdit">
          <Icon name="settings" :size="15" /> 录分
        </button>
      </template>
      <template v-else>
        <button class="gbtn" style="margin-left: auto" @click="exitEdit">取消</button>
        <button class="gbtn primary" :disabled="saving" @click="saveScores">{{ saving ? '保存中…' : '保存成绩' }}</button>
      </template>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loadingExam" class="empty" style="padding: 16px 0">加载中…</p>

    <!-- AI 考试总结（结构化分块） -->
    <div v-if="aiSummary || aiSumBusy || aiSumError" class="glass ai-card">
      <div class="head-row">
        <h3 class="sec-title" style="margin: 0">AI 考试总结 <em>{{ exam?.name }}</em></h3>
      </div>
      <p v-if="aiSumBusy" class="empty" style="padding: 6px 0">AI 正在分析本场考试…</p>
      <p v-else-if="aiSumError" class="err" style="padding: 4px 0">{{ aiSumError }}</p>
      <template v-else-if="aiSummary">
        <p class="ai-overall">{{ aiSummary.overall }}</p>
        <div class="ai-blocks">
          <div class="ai-block">
            <b class="ai-btitle">强项</b>
            <ul><li v-for="(s, i) in aiSummary.strengths" :key="i">{{ s }}</li></ul>
          </div>
          <div class="ai-block">
            <b class="ai-btitle">弱项</b>
            <ul><li v-for="(s, i) in aiSummary.weaknesses" :key="i">{{ s }}</li></ul>
          </div>
          <div class="ai-block">
            <b class="ai-btitle">建议动作</b>
            <ul><li v-for="(s, i) in aiSummary.actions" :key="i">{{ s }}</li></ul>
          </div>
        </div>
        <div v-if="aiSummary.attention?.length" class="ai-attention">
          <b class="ai-btitle">需关注学生（姓名已脱敏）</b>
          <div class="ai-attention-list">
            <span v-for="(a, i) in aiSummary.attention" :key="i" class="ai-attention-item">
              <b>{{ a.name }}</b>{{ a.reason }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <template v-if="exam && !loadingExam">
      <!-- 统计卡 -->
      <div class="stats-grid">
        <div v-for="sub in exam.subjects" :key="sub.subject" class="stat-card">
          <div class="stat-title">{{ sub.subject }}<span class="hint">（满分 {{ sub.full }}）</span></div>
          <div class="stat-line">
            <span>均分 <b class="num">{{ fmt(stats[sub.subject]?.avg) }}</b></span>
            <span>最高 <b class="num">{{ fmt(stats[sub.subject]?.max) }}</b></span>
            <span>最低 <b class="num">{{ fmt(stats[sub.subject]?.min) }}</b></span>
          </div>
          <div class="stat-line">
            <span class="ok-text">及格 {{ fmt(stats[sub.subject]?.passRate) }}%</span>
            <span style="color: var(--primary)">优秀 {{ fmt(stats[sub.subject]?.excellentRate) }}%</span>
            <span v-if="stats[sub.subject]?.absent" class="err">缺考 {{ stats[sub.subject].absent }}</span>
          </div>
          <div class="dist">
            <div
              v-for="(n, i) in stats[sub.subject]?.dist ?? []"
              :key="i"
              class="dist-col"
              :title="`${i * 10}%–${(i + 1) * 10}%：${n} 人`"
            >
              <div class="dist-bar" :style="{ height: Math.min(100, (n / Math.max(1, Math.max(...(stats[sub.subject]?.dist ?? [1]))) * 100)) + '%' }" />
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-title">总分</div>
          <div class="stat-line">
            <span>均分 <b class="num">{{ fmt(stats['总分']?.avg) }}</b></span>
            <span>最高 <b class="num">{{ fmt(stats['总分']?.max) }}</b></span>
          </div>
        </div>
      </div>

      <!-- 成绩表 / 录分矩阵 -->
      <div class="table-scroll" style="margin-top: 14px">
        <table class="gtable score-table">
          <thead>
            <tr>
              <th style="width: 34px">#</th>
              <th style="text-align: left">姓名</th>
              <th v-for="sub in exam.subjects" :key="sub.subject">{{ sub.subject }}</th>
              <th>总分</th>
              <th v-if="!editing">排名</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in students" :key="s.id" :class="{ off: !s.active }">
              <td class="num">{{ s.seq }}</td>
              <td style="text-align: left">{{ s.name }}</td>
              <td v-for="sub in exam.subjects" :key="sub.subject">
                <template v-if="editing">
                  <input
                    v-model="draft[`${s.id}|${sub.subject}`]"
                    class="ginput score-input num"
                    inputmode="decimal"
                    :placeholder="s.absent.includes(sub.subject) ? '缺考' : ''"
                    @paste="onPaste($event, s.id, sub.subject)"
                    @keydown.enter="($event.target as HTMLInputElement).blur()"
                  />
                </template>
                <template v-else>
                  <span v-if="s.scores[sub.subject] !== null" class="num">{{ fmt(s.scores[sub.subject]) }}</span>
                  <span v-else class="absent-mark">缺考</span>
                </template>
              </td>
              <td class="num"><b>{{ fmt(s.total) }}</b></td>
              <td v-if="!editing" class="num">{{ s.rank ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="editing" class="foot-note" style="margin-top: 8px">
        留空 = 缺考（不计入统计）。支持从 Excel 复制一列分数，在第一格直接粘贴，自动向下填充；保存前请核对。
      </p>

      <!-- 趋势折线 -->
      <div v-if="trendPoints" style="margin-top: 18px">
        <div class="head-row">
          <h3 class="sec-title" style="margin: 0">历次趋势</h3>
          <select v-model="trendSub" class="gselect" style="width: auto">
            <option v-for="sub in exam.subjects" :key="sub.subject" :value="sub.subject">{{ sub.subject }} 均分</option>
          </select>
          <select v-model.number="trendStudentId" class="gselect" style="width: auto">
            <option :value="null">仅班级</option>
            <option v-for="s in students" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <svg :viewBox="`0 0 ${trendPoints.W} ${trendPoints.H}`" class="trend-svg">
          <polyline :points="trendPoints.cls" fill="none" stroke="var(--primary)" stroke-width="2" />
          <circle
            v-for="(p, i) in trendPoints.clsPts"
            :key="i"
            :cx="trendPoints.x(i, trendPoints.clsPts.length)"
            :cy="trendPoints.y(p.v)"
            r="3"
            fill="var(--primary)"
          />
          <polyline v-if="trendPoints.stu" :points="trendPoints.stu" fill="none" stroke="var(--tile-exam)" stroke-width="2" stroke-dasharray="4 3" />
          <circle
            v-for="(p, i) in trendPoints.stuPts"
            :key="'s' + i"
            :cx="trendPoints.x(i, trendPoints.stuPts.length)"
            :cy="trendPoints.y(p.v)"
            r="3"
            fill="var(--tile-exam)"
          />
          <text v-for="(l, i) in trendPoints.labels" :key="'l' + i" :x="trendPoints.x(i, trendPoints.labels.length)" :y="trendPoints.H - 6" text-anchor="middle" class="trend-label">{{ l }}</text>
        </svg>
        <p class="foot-note">蓝实线 = 班级{{ trendSub }}均分；青虚线 = 选中学生的{{ trendSub }}分数。</p>
      </div>
    </template>
  </div>

  <!-- AI 点评弹层：全班一键 / 单条生成 / 编辑 / 复制 -->
  <Teleport to="body">
    <div v-if="showComments" class="gbackdrop" @click.self="showComments = false">
      <div class="gpop" style="width: min(680px, 96vw)">
        <div class="head-row">
          <h3 class="sec-title" style="margin: 0">AI 点评 · {{ exam?.name }}</h3>
          <button class="gmini" style="margin-left: auto" :disabled="genAllBusy || !aiEnabled" @click="genAllComments">
            {{ genAllBusy ? `生成中 ${genAllProgress}/${genAllTotal}` : '全班一键生成' }}
          </button>
          <button class="gmini" @click="showComments = false">关闭</button>
        </div>
        <div v-if="genAllBusy" class="progress"><div class="progress-bar" :style="{ width: (genAllProgress / Math.max(1, genAllTotal)) * 100 + '%' }" /></div>
        <p class="foot-note" style="margin: 8px 0 0">
          评语结合该生本次各科（vs 班级均分）与历次趋势生成，可直接复制发家长；也可编辑后保存。逐个生成时可在输入框补充说明。
        </p>
        <p v-if="commentsLoading" class="empty" style="padding: 12px 0">加载中…</p>
        <div v-else class="comment-list">
          <div v-for="s in students" :key="s.id" class="comment-row" :class="{ off: !s.active }">
            <div class="comment-head">
              <b>{{ s.name }}</b>
              <span class="hint num">{{ comments[s.id]?.updated_at ? comments[s.id].updated_at.slice(5, 16).replace('T', ' ') : '未生成' }}</span>
              <span style="flex: 1" />
              <button
                v-if="!editingSid || editingSid !== s.id"
                class="gmini"
                :disabled="comments[s.id]?.busy || genAllBusy"
                @click="genOneComment(s.id)"
              >
                {{ comments[s.id]?.busy ? '生成中…' : comments[s.id]?.text ? '重新生成' : '生成' }}
              </button>
              <button v-if="comments[s.id]?.text && editingSid !== s.id" class="gmini" @click="startEditComment(s.id)">编辑</button>
              <button v-if="comments[s.id]?.text && editingSid !== s.id" class="gmini" @click="copyComment(s.id)">复制</button>
            </div>
            <p v-if="comments[s.id]?.error" class="err" style="margin: 4px 0 0">{{ comments[s.id].error }}</p>
            <template v-if="editingSid === s.id">
              <textarea v-model="editText" class="gtextarea" rows="4" maxlength="600" style="margin-top: 6px; width: 100%"></textarea>
              <div class="head-row" style="justify-content: flex-end; margin-top: 6px">
                <button class="gmini" @click="editingSid = null">取消</button>
                <button class="gmini" @click="saveComment(s.id)">保存</button>
              </div>
            </template>
            <p v-else-if="comments[s.id]?.text" class="comment-text">{{ comments[s.id].text }}</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 智能导入弹层：粘贴/文件 → AI 解析 → 预览确认 → 写入 -->
  <Teleport to="body">
    <div v-if="showImport" class="gbackdrop" @click.self="showImport = false">
      <div class="gpop" style="width: min(760px, 96vw)">
        <h3 class="sec-title">智能导入成绩 · {{ exam?.name }}</h3>
        <p class="foot-note" style="margin: 0 0 8px">
          支持 Excel/CSV 上传或直接粘贴成绩单原文，格式任意（AI 解析）。
          <b class="err">解析请求将发送至 AI 服务（含学生姓名）。</b>
        </p>
        <textarea
          v-model="importText"
          class="gtextarea"
          style="width: 100%; min-height: 140px"
          placeholder="例如：&#10;姓名	语文	数学	英语	(总分)&#10;陈一	92	88	95&#10;王二	76	缺考	81"
          @keydown.enter.exact.prevent="parseImport"
        ></textarea>
        <div class="row" style="margin-top: 8px">
          <button class="gmini" @click="fileInput?.click()"><Icon name="upload" :size="13" /> 上传 Excel/CSV</button>
          <input ref="fileInput" type="file" accept=".xlsx,.csv,.txt" hidden @change="onImportFile" />
          <button class="gbtn primary" style="margin-left: auto" :disabled="importBusy || !importText.trim()" @click="parseImport">
            {{ importBusy ? 'AI 解析中…' : 'AI 解析' }}
          </button>
        </div>
        <p v-if="importError" class="err" style="margin: 8px 0 0">{{ importError }}</p>

        <!-- 预览确认 -->
        <template v-if="parsed">
          <h3 class="sec-title" style="margin-top: 16px">
            预览确认 <em>自动匹配 {{ parsed.total_matched }}/{{ parsed.rows.length }} 人</em>
          </h3>
          <div class="table-scroll" style="max-height: 340px">
            <table class="gtable">
              <thead>
                <tr>
                  <th style="text-align: left">原文姓名</th>
                  <th style="text-align: left">对应学生</th>
                  <th v-for="s in parsed.subjects" :key="s.subject">{{ s.subject }}<br /><span class="hint">满分 {{ s.full }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in parsed.rows" :key="ri" :class="{ 'unmatched-row': !row.matched }">
                  <td style="text-align: left">{{ row.name }}</td>
                  <td>
                    <select
                      class="gselect"
                      style="width: auto; min-width: 96px"
                      :class="{ 'unmatched-sel': !row.matched }"
                      @change="assignStudent(row, Number(($event.target as HTMLSelectElement).value) || null)"
                    >
                      <option :value="null" :selected="row.student_id === null">— 指认学生 —</option>
                      <option v-for="s in students" :key="s.id" :value="s.id" :selected="row.student_id === s.id">{{ s.name }}</option>
                    </select>
                  </td>
                  <td v-for="(s, si) in parsed.subjects" :key="s.subject">
                    <input
                      class="ginput score-input num"
                      :value="row.scores[s.subject] ?? ''"
                      @input="row.scores[s.subject] = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                      @change="parsed.subjects[si].subject = parsed.subjects[si].subject"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="head-row" style="justify-content: flex-end; margin-top: 12px">
            <button class="gbtn" @click="parsed = null">重新解析</button>
            <button class="gbtn primary" :disabled="saving || !parsed.rows.some((r: any) => r.matched)" @click="confirmImport">
              {{ saving ? '写入中…' : '确认写入成绩' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>

  <div v-if="toastMsg" class="gtoast">{{ toastMsg }}</div>
</template>

<style scoped>
.pad {
  padding: 16px 18px;
}
.head-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.exam-list {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
}
.exam-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 6px;
  border: none;
  border-bottom: 1px solid var(--line-soft);
  background: none;
  cursor: pointer;
  font-family: inherit;
  color: var(--text);
  text-align: left;
  transition: background 0.15s;
}
.exam-item:hover {
  background: var(--field);
}
.exam-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.exam-meta b {
  font-size: 14.5px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.stat-card {
  background: var(--field);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}
.stat-title {
  font-weight: 600;
  font-size: 13.5px;
  margin-bottom: 6px;
}
.stat-line {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 4px;
}
.stat-line b {
  color: var(--text);
  font-size: 13px;
}
.dist {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 36px;
  margin-top: 8px;
}
.dist-col {
  flex: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;
}
.dist-bar {
  width: 100%;
  min-height: 2px;
  background: var(--primary);
  opacity: 0.75;
  border-radius: 2px 2px 0 0;
}
.score-table th,
.score-table td {
  padding: 7px 8px;
}
.score-input {
  width: 58px;
  padding: 4px 6px;
  text-align: center;
}
.absent-mark {
  color: var(--faint);
  font-size: 11.5px;
}
tr.off td {
  color: var(--faint);
}
.trend-svg {
  width: 100%;
  max-width: 640px;
  display: block;
  background: var(--field);
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
}
.trend-label {
  font-size: 10px;
  fill: var(--faint);
}
.sub-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.import-acts {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}
/* ---------- AI 区块 ---------- */
.ai-act {
  margin-left: auto;
}
.ai-card {
  margin-top: 12px;
  padding: 14px 16px;
}
.ai-overall {
  margin: 8px 0 10px;
  font-size: 14px;
  line-height: 1.8;
}
.ai-blocks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.ai-block {
  background: var(--field);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.ai-btitle {
  font-size: 12.5px;
  color: var(--primary);
}
.ai-block ul {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
}
.ai-attention {
  margin-top: 10px;
}
.ai-attention-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.ai-attention-item {
  font-size: 13px;
  background: var(--absent-bg);
  border-radius: 8px;
  padding: 6px 10px;
}
.ai-attention-item b {
  margin-right: 6px;
}
.comment-list {
  max-height: 420px;
  overflow-y: auto;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.comment-row {
  background: var(--field);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.comment-row.off {
  opacity: 0.55;
}
.comment-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.comment-text {
  margin: 6px 0 0;
  font-size: 13.5px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.progress {
  height: 6px;
  background: var(--field);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 10px;
}
.progress-bar {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s var(--ease-spring);
}
.unmatched-row td {
  background: var(--absent-bg);
}
.unmatched-sel {
  border-color: var(--absent);
}
</style>
