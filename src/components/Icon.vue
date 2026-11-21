<script setup lang="ts">
// 单线 SVG 图标库（1.7px 描边，currentColor），替代 emoji 图标
const props = defineProps<{ name: string; size?: number }>()

const PATHS: Record<string, string> = {
  board: 'M3 4h18v16H3z M3 9h18 M9 9v11',
  check: 'M4 12.5l5 5L20 6.5',
  attendance: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9z M12 7v5l3.5 2.5',
  homework: 'M5 4h11l3 3v13H5z M8 9h8 M8 13h8 M8 17h5',
  manage: 'M10.5 4.5a2 2 0 1 0 3 0 M4 6h16 M6 6v6a6 6 0 0 0 12 0V6 M12 18v3',
  settings:
    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M12 2.8l1 2.6 2.7.8 2.3-1.5 1.8 1.8-1.5 2.3.8 2.7 2.6 1v2.6l-2.6 1-.8 2.7 1.5 2.3-1.8 1.8-2.3-1.5-2.7.8-1 2.6h-2.6l-1-2.6-2.7-.8-2.3 1.5-1.8-1.8 1.5-2.3-.8-2.7-2.6-1v-2.6l2.6-1 .8-2.7L4.2 4.9 6 3.1l2.3 1.5 2.7-.8 1-2.6z',
  logout: 'M9 4H5v16h4 M13 8l4 4-4 4 M17 12H8',
  plus: 'M12 5v14 M5 12h14',
  chevronLeft: 'M14.5 5.5L8 12l6.5 6.5',
  chevronRight: 'M9.5 5.5L16 12l-6.5 6.5',
  moon: 'M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  trash: 'M4 6h16 M9 6V4h6v2 M6.5 6l1 14h9l1-14 M10 10v6 M14 10v6',
  clock: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9z M12 7.5V12l3 2',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  users: 'M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6 6 0 0 1 12 0 M15.5 4.6a3.5 3.5 0 0 1 0 6.8 M16 14.4a6 6 0 0 1 5.5 5.6',
  download: 'M12 4v11 M7.5 10.5L12 15l4.5-4.5 M4 19h16',
  upload: 'M12 15V4 M7.5 8.5L12 4l4.5 4.5 M4 19h16',
  lock: 'M6 11h12v9H6z M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  monitor: 'M3 4h18v12H3z M9 20h6 M12 16v4',
  quote: 'M7.5 6C5.5 7 4.5 9 4.5 11.5V18h6v-6H7c0-2 .8-3.5 2.5-4.5z M16.5 6c-2 1-3 3-3 5.5V18h6v-6h-3.5c0-2 .8-3.5 2.5-4.5z',
  chat: 'M4 5.5h16v10H9l-5 4z M8.5 10.5h.01 M12 10.5h.01 M15.5 10.5h.01',
  mic: 'M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6',
  image: 'M4 5h16v14H4z M4 15l5-5 4 4 3-3 4 4 M9.5 8.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
  send: 'M4 12L20 4l-4 16-5-6z M20 4L11 14',
  play: 'M8 5.5l10 6.5-10 6.5z',
  x: 'M6 6l12 12 M18 6L6 18',
  bell: 'M6 10a6 6 0 0 1 12 0c0 5 1.8 6.5 2.2 7H3.8C4.2 16.5 6 15 6 10z M10.3 20a2 2 0 0 0 3.4 0',
  bellOff: 'M6 10a6 6 0 0 1 12 0c0 5 1.8 6.5 2.2 7H3.8C4.2 16.5 6 15 6 10z M10.3 20a2 2 0 0 0 3.4 0 M4 4l16 16',
  info: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9z M12 8h.01 M12 11.5v5.5',
  exam: 'M4 20V9 M9.5 20V4 M15 20v-7 M20.5 20V6 M3 20h18.5',
}

const svgPath = PATHS[props.name] ?? PATHS.check
</script>

<template>
  <svg
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="svgPath" />
  </svg>
</template>
