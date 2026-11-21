<script setup lang="ts">
/**
 * 报告用纵向柱状图（分数段人数分布）。
 */
const props = defineProps<{
  items: Array<{ label: string; value: number }>
  height?: number
}>()

const H = props.height ?? 220
const W = 960
const PAD_L = 40
const PAD_B = 40
const PAD_T = 26

const maxV = Math.max(...props.items.map((i) => i.value), 1)
const bandW = (W - PAD_L - 20) / Math.max(props.items.length, 1)
const barW = Math.min(bandW * 0.62, 64)
const x = (i: number) => PAD_L + bandW * i + (bandW - barW) / 2
const h = (v: number) => ((H - PAD_T - PAD_B) * v) / maxV
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="rpt-vbars" xmlns="http://www.w3.org/2000/svg">
    <g v-for="(it, i) in items" :key="i">
      <rect v-if="it.value > 0" :x="x(i)" :y="H - PAD_B - h(it.value)" :width="barW" :height="h(it.value)" rx="8"
        :fill="i === items.length - 1 ? '#34c759' : '#007aff'" opacity="0.9" />
      <text v-if="it.value > 0" :x="x(i) + barW / 2" :y="H - PAD_B - h(it.value) - 8" text-anchor="middle" class="val">{{ it.value }}</text>
      <text :x="x(i) + barW / 2" :y="H - PAD_B + 24" text-anchor="middle" class="tick">{{ it.label }}</text>
    </g>
    <line :x1="PAD_L" :x2="W - 20" :y1="H - PAD_B" :y2="H - PAD_B" stroke="rgba(0,0,0,0.12)" stroke-width="1" />
  </svg>
</template>

<style scoped>
.rpt-vbars { width: 100%; height: auto; display: block; }
.tick { font-size: 17px; fill: #86868b; font-family: MiSans, sans-serif; }
.val { font-size: 19px; font-weight: 600; fill: #1d1d1f; font-family: MiSans, sans-serif; }
</style>
