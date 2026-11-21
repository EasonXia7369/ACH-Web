<script setup lang="ts">
import BrandLogo from '@/components/BrandLogo.vue'
import RptLineChart from './RptLineChart.vue'
import RptHBars from './RptHBars.vue'
import RptVBars from './RptVBars.vue'

/**
 * 报告文档（1080px 定宽，屏幕预览 = 导出长图同源 DOM）。
 * 配色为固定浅色（不随暗色主题），保证导出图稳定。
 */
export interface ReportVM {
  title: string
  className: string
  rangeText: string
  generatedAt: string
  aiText: string
  dailyPoints: Array<{ label: string; value: number }>
  compare: Array<{ label: string; cur: string; delta: string; up: boolean; good: boolean }> | null
  attendance: Array<{ seq: number; name: string; leave: number; late: number; absent: number; violate: number; total: number }>
  leaves: Array<{ name: string; range: string; reason: string }>
  homework: Array<{ name: string; count: number; detail: string }>
  exam: {
    name: string
    day: string
    subjects: Array<{ label: string; value: number; max: number }>
    bands: Array<{ label: string; value: number }>
    avgTotal: string | null
    passRate: string | null
    excellentRate: string | null
  } | null
  examTrend: Array<{ label: string; value: number }> | null
  monthExamRows: Array<{ name: string; day: string; avgTotal: string }>
  diagnosis: {
    overall: string
    strengths: string[]
    weaknesses: string[]
    attention: Array<{ name: string; reason: string }>
  } | null
  qrDataUrl: string
}

defineProps<{ vm: ReportVM }>()
</script>

<template>
  <div class="rpt">
    <!-- 页眉 -->
    <header class="head">
      <div class="brand">
        <BrandLogo :size="52" />
        <span class="brand-name">方舟班级中心</span>
      </div>
      <div class="head-main">
        <h1>{{ vm.className }} {{ vm.title }}</h1>
        <p class="range">{{ vm.rangeText }}</p>
      </div>
      <div class="head-right">生成于 {{ vm.generatedAt }}</div>
    </header>

    <!-- AI 总结 -->
    <section v-if="vm.aiText" class="sec ai-sec">
      <h2><span class="dot" />AI 班级总结</h2>
      <p class="ai-text">{{ vm.aiText }}</p>
    </section>

    <!-- 出勤趋势 + 环比 -->
    <section v-if="vm.dailyPoints.length" class="sec">
      <h2><span class="dot" />出勤趋势</h2>
      <RptLineChart :points="vm.dailyPoints" :height="230" avg-line />
      <div v-if="vm.compare?.length" class="compare">
        <div v-for="(c, i) in vm.compare" :key="i" class="cmp">
          <span class="cmp-label">{{ c.label }}</span>
          <span class="cmp-cur">{{ c.cur }}</span>
          <span class="cmp-delta" :class="c.delta === '—' || c.delta === '持平' ? '' : c.good ? 'up' : 'down'">
            {{ c.delta }}
            <template v-if="c.delta !== '—' && c.delta !== '持平'">{{ c.good ? '↑ 改善' : '↓ 需关注' }}</template>
          </span>
        </div>
      </div>
    </section>

    <!-- 全班考勤表 -->
    <section class="sec">
      <h2><span class="dot" />全班考勤</h2>
      <table class="att-table">
        <thead>
          <tr><th>序号</th><th class="tl">姓名</th><th>请假</th><th>迟到</th><th>旷课</th><th>违纪</th><th>合计</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in vm.attendance" :key="s.seq">
            <td>{{ s.seq }}</td>
            <td class="tl">{{ s.name }}</td>
            <td :class="{ bad: s.leave > 0 }">{{ s.leave || '-' }}</td>
            <td :class="{ bad: s.late > 0 }">{{ s.late || '-' }}</td>
            <td :class="{ bad: s.absent > 0 }">{{ s.absent || '-' }}</td>
            <td :class="{ bad: s.violate > 0 }">{{ s.violate || '-' }}</td>
            <td :class="{ bad: s.total > 0 }">{{ s.total || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 成绩块 -->
    <section v-if="vm.exam || vm.examTrend || vm.monthExamRows.length" class="sec">
      <h2><span class="dot" />考试成绩</h2>

      <!-- 月报：区间考试汇总行 -->
      <table v-if="vm.monthExamRows.length" class="exam-rows">
        <thead><tr><th class="tl">考试</th><th>日期</th><th>总分均分</th></tr></thead>
        <tbody>
          <tr v-for="(e, i) in vm.monthExamRows" :key="i">
            <td class="tl">{{ e.name }}</td>
            <td>{{ e.day }}</td>
            <td>{{ e.avgTotal }}</td>
          </tr>
        </tbody>
      </table>

      <!-- 最近一次考试 -->
      <template v-if="vm.exam">
        <p class="exam-sub">最近一次：{{ vm.exam.name }}（{{ vm.exam.day }}）</p>
        <div class="kv-row" v-if="vm.exam.avgTotal">
          <div class="kv"><span class="k">总分均分</span><span class="v">{{ vm.exam.avgTotal }}</span></div>
          <div class="kv" v-if="vm.exam.passRate"><span class="k">及格率</span><span class="v">{{ vm.exam.passRate }}</span></div>
          <div class="kv" v-if="vm.exam.excellentRate"><span class="k">优秀率</span><span class="v">{{ vm.exam.excellentRate }}</span></div>
        </div>
        <p class="chart-cap">各科得分率（橙色为相对最弱科目）</p>
        <RptHBars :items="vm.exam.subjects" />
        <p class="chart-cap">总分分数段人数</p>
        <RptVBars :items="vm.exam.bands" :height="200" />
      </template>

      <!-- 历次总分均分趋势 -->
      <template v-if="vm.examTrend && vm.examTrend.length > 1">
        <p class="chart-cap">历次考试总分均分</p>
        <RptLineChart :points="vm.examTrend" :pct-mode="false" :height="210" />
      </template>
    </section>

    <!-- AI 考试诊断 -->
    <section v-if="vm.diagnosis" class="sec ai-sec">
      <h2><span class="dot" />AI 考试诊断</h2>
      <p class="ai-text">{{ vm.diagnosis.overall }}</p>
      <div class="diag-grid">
        <div v-if="vm.diagnosis.strengths.length" class="diag-col">
          <p class="diag-title good">强项</p>
          <p v-for="(s, i) in vm.diagnosis.strengths" :key="i" class="diag-line">{{ s }}</p>
        </div>
        <div v-if="vm.diagnosis.weaknesses.length" class="diag-col">
          <p class="diag-title warn">弱项</p>
          <p v-for="(s, i) in vm.diagnosis.weaknesses" :key="i" class="diag-line">{{ s }}</p>
        </div>
      </div>
      <div v-if="vm.diagnosis.attention.length" class="attention">
        <span class="diag-title warn" style="margin: 0">需关注</span>
        <span v-for="(a, i) in vm.diagnosis.attention" :key="i" class="att-chip">{{ a.name }}（{{ a.reason }}）</span>
      </div>
    </section>

    <!-- 请假 / 作业未交 -->
    <section v-if="vm.leaves.length || vm.homework.length" class="sec two-col">
      <div v-if="vm.leaves.length">
        <h2><span class="dot" />请假明细</h2>
        <p v-for="(l, i) in vm.leaves" :key="i" class="line-item">
          <b>{{ l.name }}</b>（{{ l.range }}）<span v-if="l.reason">：{{ l.reason }}</span>
        </p>
      </div>
      <div v-if="vm.homework.length">
        <h2><span class="dot" />作业未交</h2>
        <p v-for="(h, i) in vm.homework" :key="i" class="line-item">
          <b>{{ h.name }}</b>（{{ h.count }} 次）<span class="muted">：{{ h.detail }}</span>
        </p>
      </div>
    </section>

    <!-- 页脚 -->
    <footer class="foot">
      <div class="foot-brand">
        <BrandLogo :size="40" />
        <span>方舟班级中心 · Ark Class Hub</span>
      </div>
      <div v-if="vm.qrDataUrl" class="foot-qr">
        <img :src="vm.qrDataUrl" alt="家长视图" />
        <span>扫码查看孩子作业与课表</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.rpt {
  width: 1080px;
  background: #f5f5f7;
  padding: 56px 48px 40px;
  font-family: MiSans, sans-serif;
  color: #1d1d1f;
  box-sizing: border-box;
}
.head { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 36px; }
.brand { display: flex; align-items: center; gap: 10px; padding-top: 6px; }
.brand-name { font-size: 22px; font-weight: 600; letter-spacing: 2px; color: #6e6e73; }
.head-main { flex: 1; }
.head h1 { font-size: 56px; font-weight: 700; margin: 0; line-height: 1.15; }
.range { font-size: 24px; color: #6e6e73; margin: 10px 0 0; }
.head-right { font-size: 20px; color: #a1a1a6; padding-top: 16px; white-space: nowrap; }

.sec { background: #fff; border-radius: 24px; padding: 36px 40px; margin-bottom: 24px; }
.sec h2 { font-size: 30px; font-weight: 600; margin: 0 0 22px; display: flex; align-items: center; gap: 12px; }
.dot { width: 10px; height: 10px; border-radius: 5px; background: #007aff; flex: none; }

.ai-sec { background: linear-gradient(135deg, #f0f6ff, #fff); }
.ai-text { font-size: 25px; line-height: 1.7; margin: 0; white-space: pre-wrap; }

.compare { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 22px; }
.cmp { background: #f5f5f7; border-radius: 16px; padding: 14px 18px; }
.cmp-label { display: block; font-size: 19px; color: #6e6e73; }
.cmp-cur { display: block; font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 4px; }
.cmp-delta { display: block; font-size: 18px; margin-top: 2px; color: #86868b; }
.cmp-delta.up { color: #34c759; }
.cmp-delta.down { color: #ff3b30; }

.att-table { width: 100%; border-collapse: collapse; font-size: 23px; }
.att-table th { font-size: 21px; color: #6e6e73; font-weight: 500; padding: 10px 8px; border-bottom: 1px solid rgba(0,0,0,0.12); }
.att-table td { padding: 11px 8px; text-align: center; border-bottom: 1px solid rgba(0,0,0,0.06); font-variant-numeric: tabular-nums; }
.att-table th:first-child, .att-table td:first-child { width: 72px; color: #a1a1a6; }
.att-table .tl { text-align: left; font-weight: 500; }
.att-table .bad { color: #ff3b30; font-weight: 600; }

.exam-rows { width: 100%; border-collapse: collapse; font-size: 23px; margin-bottom: 26px; }
.exam-rows th { font-size: 21px; color: #6e6e73; font-weight: 500; text-align: center; padding: 10px 8px; border-bottom: 1px solid rgba(0,0,0,0.12); }
.exam-rows td { padding: 11px 8px; text-align: center; border-bottom: 1px solid rgba(0,0,0,0.06); }
.exam-rows .tl { text-align: left; }
.exam-sub { font-size: 24px; font-weight: 600; margin: 0 0 18px; }
.kv-row { display: flex; gap: 16px; margin-bottom: 22px; }
.kv { background: #f5f5f7; border-radius: 16px; padding: 14px 24px; }
.kv .k { display: block; font-size: 19px; color: #6e6e73; }
.kv .v { display: block; font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
.chart-cap { font-size: 21px; color: #6e6e73; margin: 26px 0 14px; }

.diag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 22px; }
.diag-col { background: #f5f5f7; border-radius: 16px; padding: 18px 22px; }
.diag-title { font-size: 21px; font-weight: 600; margin: 0 0 10px; display: block; }
.diag-title.good { color: #34c759; }
.diag-title.warn { color: #ff9500; }
.diag-line { font-size: 22px; line-height: 1.6; margin: 0 0 8px; }
.attention { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 18px; }
.att-chip { background: #fff4e5; color: #b25000; border-radius: 999px; padding: 8px 18px; font-size: 21px; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
.two-col h2 { margin-bottom: 16px; }
.line-item { font-size: 23px; line-height: 1.7; margin: 0 0 6px; }
.line-item .muted { color: #6e6e73; }

.foot { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 0; }
.foot-brand { display: flex; align-items: center; gap: 12px; font-size: 22px; color: #a1a1a6; }
.foot-qr { display: flex; align-items: center; gap: 14px; }
.foot-qr img { width: 128px; height: 128px; border-radius: 16px; background: #fff; }
.foot-qr span { font-size: 20px; color: #6e6e73; }
</style>
