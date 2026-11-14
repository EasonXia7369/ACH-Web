<script setup lang="ts">
import { computed } from 'vue'
import { useClassStore } from '@/stores/class'
import HomeworkBoard from '@/components/HomeworkBoard.vue'

const store = useClassStore()
</script>

<template>
  <HomeworkBoard v-if="store.current" :class-id="store.current.id" />
</template>
