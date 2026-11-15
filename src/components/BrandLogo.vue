<script setup lang="ts">
// 品牌标识「方舟」：船体 + 桅杆对勾 + 水纹（与 favicon 同源）
const props = defineProps<{ size?: number }>()
const uid = `arklg-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <svg :width="size ?? 20" :height="size ?? 20" viewBox="0 0 128 128" aria-hidden="true">
    <defs>
      <linearGradient :id="uid" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4f8dff" />
        <stop offset="1" stop-color="#2f49b2" />
      </linearGradient>
      <clipPath :id="uid + 'c'"><rect width="128" height="128" rx="30" /></clipPath>
    </defs>
    <rect width="128" height="128" :rx="30" :fill="`url(#${uid})`" />
    <g :clip-path="`url(#${uid}c)`" fill="#ffffff">
      <path d="M30 74 L98 74 Q96 92 64 94 Q32 92 30 74 Z" opacity=".96" />
      <path d="M60 40 L72 30 V70 H60 Z" opacity=".55" />
    </g>
    <path
      d="M62 56 L70 64 L86 42"
      fill="none"
      stroke="#ffffff"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <g stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" opacity=".7" fill="none">
      <path d="M26 104 Q40 98 54 104 T82 104 T110 104" />
      <path d="M34 114 Q48 108 62 114 T90 114" opacity=".55" />
    </g>
  </svg>
</template>
