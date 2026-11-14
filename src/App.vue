<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppShell from '@/components/AppShell.vue'

const route = useRoute()
const isShell = computed(() => !route.meta.public)
</script>

<template>
  <AppShell v-if="isShell">
    <RouterView />
  </AppShell>
  <RouterView v-else />
</template>
