<script setup lang="ts">
/**
 * 报告用 SVG 折线图（导出图内使用，固定浅色配色）。
 * points: { label: x 轴标签, value: 数值 }；value 按 pctMode 决定 0~1（画成百分比）或原值。
 */
const props = withDefaults(
  defineProps<{
    points: Array<{ label: string; value: number }>
    pctMode?: boolean
    height?: number
    /** 显示平均值虚线 */
    avgLine?: boolean
  }>(),
  { pctMode: true, height: 240, avgLine: false },
)

const W = 960
const H = props.height
const PAD_L = 64
const PAD_R = 28
const PAD_T = 24
const PAD_B = 44

const vals = props.points.map((p) => p.value)
const hasData = props.points.length > 0 && vals.some((v) => Number.isFinite(v))

// y 轴范围：留余量；pctMode 固定以 0 为下界候选
const yMinRaw = Math.min(...(hasData ? vals : [0]))
const yMaxRaw = Math.max(...(hasData ? vals : [1]))
const span = yMaxRaw - yMinRaw || (props.pctMode ? 0.2 : 1)
const yMin = props.pctMode ? Math.max(0, yMinRaw - span * 0.25) : yMinRaw - span * 0.15
const yMax = yMaxRaw + span * 0.2

const x = (i: number) => (props.points.length <= 1 ? (PAD_L + (W - PAD_L - PAD_R) / 2) : PAD_L + ((W - PAD_L - PAD_R) * i) / (props.points.length - 1))
const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - (v - yMin) / (yMax - yMin || 1))

const polyline = hasData
  ? props.points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  : ''
const area = hasData
  ? `${PAD_L},${H - PAD_B} ${polyline} ${x(props.points.length - 1).toFixed(1)},${H - PAD_B}`
  : ''

const fmt = (v: number) => (props.pctMode ? `${Math.round(v * 100)}%` : String(Math.round(v * 10) / 10))
const avg = hasData ? vals.reduce((a, b) => a + b, 0) / vals.length : 0

// x 轴标签稀疏化：最多 8 个
const tickEvery = Math.ceil(props.points.length / 8)

const yTicks = (() => {
  const n = 4
  return Array.from({ length: n + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / n)
})()
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="rpt-line" xmlns="http://www.w3.org/2000/svg">
    <!-- 网格 -->
    <g v-for="(t, i) in yTicks" :key="i">
      <line :x1="PAD_L" :x2="W - PAD_R" :y1="y(t)" :y2="y(t)" stroke="rgba(0,0,0,0.07)" stroke-width="1" />
      <text :x="PAD_L - 8" :y="y(t) + 5" text-anchor="end" class="tick">{{ fmt(t) }}</text>
    </g>

    <template v-if="hasData">
      <!-- 均值线 -->
      <g v-if="avgLine">
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="y(avg)" :y2="y(avg)" stroke="#ff9500" stroke-width="1.5" stroke-dasharray="6 5" />
        <text :x="W - PAD_R - 4" :y="y(avg) - 6" text-anchor="end" class="tick" fill="#ff9500">均值 {{ fmt(avg) }}</text>
      </g>

      <!-- 面积 + 折线 -->
      <polygon :points="area" fill="rgba(0,122,255,0.10)" />
      <polyline :points="polyline" fill="none" stroke="#007aff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />

      <!-- 数据点：首/尾/最低/最高 标注数值 -->
      <g v-for="(p, i) in points" :key="i">
        <circle :cx="x(i)" :cy="y(p.value)" r="5" fill="#007aff" stroke="#fff" stroke-width="2" />
        <text
          v-if="i === 0 || i === points.length - 1 || p.value === yMinRaw || p.value === yMaxRaw"
          :x="x(i)" :y="y(p.value) - 12" text-anchor="middle" class="val"
        >{{ fmt(p.value) }}</text>
      </g>

      <!-- x 标签（稀疏） -->
      <text v-for="(p, i) in points" v-show="i % tickEvery === 0 || i === points.length - 1" :key="'x' + i"
        :x="x(i)" :y="H - PAD_B + 26" text-anchor="middle" class="tick">{{ p.label }}</text>
    </template>
    <text v-else :x="W / 2" :y="H / 2" text-anchor="middle" class="tick">区间内暂无数据</text>
  </svg>
</template>

<style scoped>
.rpt-line { width: 100%; height: auto; display: block; }
.tick { font-size: 17px; fill: #86868b; font-family: MiSans, sans-serif; }
.val { font-size: 19px; font-weight: 600; fill: #1d1d1f; font-family: MiSans, sans-serif; }
</style>
