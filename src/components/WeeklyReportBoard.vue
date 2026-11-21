<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { get, post } from '@/api'
import { useClassStore } from '@/stores/class'
import { exportXlsx } from '@/utils/xlsx'
import { saveFile } from '@/utils/platform'
import { weekdayCn } from '@/utils/dates'
import { useAi } from '@/composables/useAi'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ classId: number }>()
const store = useClassStore()
const { aiEnabled, ensureStatus } = useAi()
ensureStatus()

const monday = ref(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'))
const report = ref<any>(null)
const loading = ref(false)

const from = computed(() => monday.value)
const to = computed(() => dayjs(monday.value).add(6, 'day').format('YYYY-MM-DD'))
const rangeLabel = computed(
  () => `${from.value} ~ ${to.value}`,
)

function shiftWeek(n: number) {
  monday.value = dayjs(monday.value).add(n * 7, 'day').format('YYYY-MM-DD')
}

async function load() {
  loading.value = true
  try {
    report.value = await get<any>(
      `/api/classes/${props.classId}/report?from=${from.value}&to=${to.value}`,
    )
  } finally {
    loading.value = false
  }
}

watch([monday, props.classId], load, { immediate: true })

/* ---------- AI 周总结 ---------- */
const aiText = ref('')
const aiBusy = ref(false)
const aiError = ref('')

async function genSummary() {
  if (aiBusy.value) return
  aiBusy.value = true
  aiError.value = ''
  aiText.value = ''
  try {
    const res = await post<{ text: string }>(`/api/classes/${props.classId}/report/summary`, {
      from: from.value,
      to: to.value,
    })
    aiText.value = res.text
  } catch (e: any) {
    aiError.value = e.message
  } finally {
    aiBusy.value = false
  }
}

async function copyAiText() {
  try {
    await navigator.clipboard.writeText(aiText.value)
    toastMsg.value = '已复制'
    setTimeout(() => (toastMsg.value = ''), 1800)
  } catch {
    toastMsg.value = '复制失败，请手动选择文本'
  }
}
const toastMsg = ref('')

async function exportXlsxReport() {
  const r = report.value
  if (!r) return
  await exportXlsx(`周报_${store.current?.name}_${from.value}.xlsx`, [
    {
      name: '考勤汇总',
      header: ['序号', '姓名', '请假', '迟到', '旷课', '违纪', '合计'],
      rows: r.attendance.map((s: any, i: number) => [i + 1, s.name, s.leave, s.late, s.absent, s.violate, s.total]),
      widths: [6, 12, 8, 8, 8, 8, 8],
      freeze: 1,
    },
    {
      name: '请假明细',
      header: ['学生', '起', '止', '事由'],
      rows: r.leaves.map((l: any) => [l.name, l.from_day, l.to_day, l.reason]),
      widths: [12, 12, 12, 30],
    },
    {
      name: '作业未交',
      header: ['姓名', '未交次数', '明细'],
      rows: r.homework.filter((h: any) => h.count).map((h: any) => [h.name, h.count, h.detail.join('；')]),
      widths: [12, 10, 60],
    },
  ])
}

/* 生成分享图片：1080 宽竖版，画布排版 */
async function exportImage() {
  const r = report.value
  if (!r) return
  const W = 1080
  const PAD = 64
  const scale = 2 // 2x 抗锯齿
  const canvas = document.createElement('canvas')

  // 先量高度
  const rowH = 52
  const headH = 240
  const attH = r.attendance.length * rowH + 120
  const hwH = r.homework.filter((h: any) => h.count).length * 44 + 90
  const leaveH = r.leaves.length * 44 + 90
  const footH = 120
  const H = headH + attH + hwH + leaveH + footH
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // 背景
  ctx.fillStyle = '#f5f5f7'
  ctx.fillRect(0, 0, W, H)
  // 卡片
  const cardX = 24
  const cardW = W - 48
  const cardR = 28
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(cardX, 24, cardW, H - 48, cardR)
  ctx.fill()

  let y = 96
  ctx.fillStyle = '#1d1d1f'
  ctx.font = '600 52px MiSans, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(`${store.current?.name ?? '班级'} 周报`, cardX + 48, y)
  y += 74
  ctx.fillStyle = '#6e6e73'
  ctx.font = '400 26px MiSans, sans-serif'
  ctx.fillText(`${rangeLabel.value}（${weekdayCn(from.value)} 起）`, cardX + 48, y)
  y += 90

  const section = (title: string, yy: number) => {
    ctx.fillStyle = '#007aff'
    ctx.font = '600 30px MiSans, sans-serif'
    ctx.fillText(title, cardX + 48, yy)
    return yy + 56
  }
  const line = (x1: number, yy: number) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.beginPath()
    ctx.moveTo(x1, yy)
    ctx.lineTo(cardX + cardW - 48, yy)
    ctx.stroke()
  }

  // 考勤表
  y = section('出勤情况', y)
  ctx.font = '500 26px MiSans, sans-serif'
  const cols = [cardX + 60, cardX + 200, cardX + 380, cardX + 560, cardX + 740, cardX + 880]
  const headers = ['姓名', '请假', '迟到', '旷课', '违纪', '合计']
  ctx.fillStyle = '#6e6e73'
  headers.forEach((h, i) => ctx.fillText(h, cols[i], y))
  y += 48
  line(cardX + 48, y - 12)
  for (const s of r.attendance) {
    ctx.fillStyle = '#1d1d1f'
    ctx.fillText(s.name, cols[0], y)
    const vals = [s.leave, s.late, s.absent, s.violate, s.total]
    vals.forEach((v, i) => {
      ctx.fillStyle = v > 0 ? '#ff3b30' : '#a1a1a6'
      ctx.fillText(String(v), cols[i + 1], y)
    })
    y += rowH
  }
  y += 40

  // 作业未交
  const hw = r.homework.filter((h: any) => h.count)
  if (hw.length) {
    y = section('作业未交', y)
    ctx.font = '500 26px MiSans, sans-serif'
    for (const h of hw) {
      ctx.fillStyle = '#1d1d1f'
      ctx.fillText(`${h.name}（${h.count} 次）`, cardX + 60, y)
      y += 44
    }
    y += 40
  }

  // 请假
  if (r.leaves.length) {
    y = section('请假', y)
    ctx.font = '400 26px MiSans, sans-serif'
    for (const l of r.leaves) {
      ctx.fillStyle = '#1d1d1f'
      ctx.fillText(`${l.name}：${l.from_day} ~ ${l.to_day}${l.reason ? '（' + l.reason + '）' : ''}`, cardX + 60, y)
      y += 44
    }
    y += 40
  }

  // 页脚
  ctx.fillStyle = '#a1a1a6'
  ctx.font = '400 22px MiSans, sans-serif'
  ctx.fillText('班级中心 · Ark Class Hub', cardX + 48, H - 96)

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png'),
  )
  await saveFile(`周报_${store.current?.name}_${from.value}.png`, blob)
}
</script>

<template>
  <div class="toolbar card">
    <button class="nav" @click="shiftWeek(-1)">‹</button>
    <span class="range-label">{{ rangeLabel }}（{{ weekdayCn(from) }} ~ {{ weekdayCn(to) }}）</span>
    <button class="nav" @click="shiftWeek(1)">›</button>
    <button class="gmini" @click="monday = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD')">本周</button>
    <button
      v-if="aiEnabled"
      class="gmini ai-btn"
      :disabled="aiBusy"
      :title="'AI 生成本周总结，可直接复制发家长群'"
      @click="genSummary"
    >
      <Icon name="quote" :size="13" /> {{ aiBusy ? 'AI 写作中…' : 'AI 总结' }}
    </button>
  </div>

  <!-- AI 周总结结果 -->
  <div v-if="aiEnabled && (aiText || aiBusy || aiError)" class="glass pad" style="margin-top: 12px">
    <div class="head-row-ai">
      <h3 class="sec-title" style="margin: 0">AI 周总结 <em>{{ rangeLabel }}</em></h3>
      <button v-if="aiText" class="gmini" @click="copyAiText">复制</button>
    </div>
    <p v-if="aiBusy" class="empty" style="padding: 8px 0">AI 正在根据本周数据写总结…</p>
    <p v-else-if="aiError" class="err" style="padding: 4px 0">{{ aiError }}</p>
    <p v-else class="ai-text">{{ aiText }}</p>
    <p class="foot-note" style="margin: 8px 0 0">学生姓名已脱敏后才发送给 AI；发送前请自行核对内容。</p>
  </div>

  <div v-if="report" class="grid">
    <div class="glass pad">
      <h3 class="sec-title">出勤情况 <em>{{ report.total_students }} 人</em></h3>
      <div class="table-scroll">
      <table class="gtable stats">
        <thead>
          <tr><th>#</th><th style="text-align: left">姓名</th><th>请假</th><th>迟到</th><th>旷课</th><th>违纪</th><th>合计</th></tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in report.attendance" :key="s.name">
            <td class="idx">{{ i + 1 }}</td>
            <td class="name">{{ s.name }}</td>
            <td :class="{ nz: s.leave }">{{ s.leave || '' }}</td>
            <td :class="{ nz: s.late }">{{ s.late || '' }}</td>
            <td :class="{ nz: s.absent }">{{ s.absent || '' }}</td>
            <td :class="{ nz: s.violate }">{{ s.violate || '' }}</td>
            <td class="total">{{ s.total || '' }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div class="glass pad">
      <h3 class="sec-title">请假 <em>{{ report.leaves.length }}</em></h3>
      <div v-if="report.leaves.length" class="lines">
        <div v-for="(l, i) in report.leaves" :key="i" class="line-item">
          <b>{{ l.name }}</b>：{{ l.from_day }} ~ {{ l.to_day }}<span v-if="l.reason">（{{ l.reason }}）</span>
        </div>
      </div>
      <p v-else class="empty">本周没有请假</p>

      <h3 class="sec-title" style="margin-top: 18px">作业未交 <em>{{ report.homework.filter((h: any) => h.count).length }} 人</em></h3>
      <div v-if="report.homework.filter((h: any) => h.count).length" class="lines">
        <div v-for="h in report.homework.filter((x: any) => x.count)" :key="h.name" class="line-item">
          <b>{{ h.name }}</b>（{{ h.count }} 次）<span class="foot-note">{{ h.detail[0] }}{{ h.detail.length > 1 ? ' 等' : '' }}</span>
        </div>
      </div>
      <p v-else class="empty">本周无未交记录</p>
    </div>
  </div>

  <div class="acts">
    <button class="gbtn" :disabled="!report" @click="exportXlsxReport"><Icon name="download" :size="15" /> 导出 Excel</button>
    <button class="gbtn primary" :disabled="!report" @click="exportImage"><Icon name="image" :size="15" /> 生成图片（发家长群）</button>
  </div>
</template>

<style scoped>
.card,
.glass {
  background: var(--panel);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
/* 手机端：区间标签独占一行，导航与按钮放下一行 */
@media (max-width: 860px) {
  .toolbar .range-label {
    flex: 1 1 100%;
    order: -1;
  }
  .toolbar .nav {
    flex: 1;
  }
  .toolbar .gmini {
    flex: 1;
    text-align: center;
  }
}
.nav {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--field);
  font-size: 17px;
  color: var(--muted);
  cursor: pointer;
  flex: none;
}
.range-label {
  flex: 1;
  text-align: center;
  font-weight: 700;
  font-size: 14.5px;
  padding: 8px 4px;
  background: var(--field);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.ai-btn {
  color: var(--primary);
  border-color: var(--primary);
  flex: none;
  margin-left: 8px;
}
.head-row-ai {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.ai-text {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
.gmini {
  padding: 7px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--field);
  font-size: 12.5px;
  color: var(--muted);
  cursor: pointer;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 860px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.pad {
  padding: 16px 18px;
}
.stats th {
  text-align: center;
}
.stats td {
  text-align: center;
}
.stats td.name {
  text-align: left;
  font-weight: 600;
}
.idx {
  color: var(--faint);
}
.nz {
  font-weight: 700;
  color: var(--absent);
}
.total {
  font-weight: 700;
}
.lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.line-item {
  font-size: 13px;
  padding: 6px 8px;
  background: var(--field);
  border-radius: 8px;
}
.acts {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
</style>
