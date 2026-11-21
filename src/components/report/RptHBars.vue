<script setup lang="ts">
/**
 * 报告用横向条形图（科目得分率对比）。value/max → 百分比条；最低项橙色高亮。
 */
const props = defineProps<{
  items: Array<{ label: string; value: number; max: number }>
  /** 值后缀（默认 %） */
  unit?: string
}>()

const rows = props.items.map((it) => {
  const rate = it.max > 0 ? it.value / it.max : 0
  return { ...it, rate, pct: Math.round(rate * 1000) / 10 }
})
const minRate = Math.min(...rows.map((r) => r.rate))
</script>

<template>
  <div class="rpt-hbars">
    <div v-for="(r, i) in rows" :key="i" class="row">
      <span class="lbl">{{ r.label }}</span>
      <div class="track">
        <div class="fill" :class="{ low: rows.length > 1 && r.rate === minRate }" :style="{ width: Math.max(r.rate * 100, 2) + '%' }" />
      </div>
      <span class="num">{{ r.value }} / {{ r.max }}<em>{{ r.pct + (unit ?? '%') }}</em></span>
    </div>
  </div>
</template>

<style scoped>
.rpt-hbars { display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; align-items: center; gap: 16px; }
.lbl { width: 88px; text-align: right; font-size: 22px; color: #1d1d1f; font-weight: 500; flex: none; }
.track { flex: 1; height: 26px; background: rgba(0,0,0,0.05); border-radius: 13px; overflow: hidden; }
.fill { height: 100%; background: #007aff; border-radius: 13px; transition: none; }
.fill.low { background: #ff9500; }
.num { width: 170px; flex: none; font-size: 20px; color: #6e6e73; font-variant-numeric: tabular-nums; }
.num em { font-style: normal; margin-left: 10px; font-weight: 600; color: #1d1d1f; }
</style>
