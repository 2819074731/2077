<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ src?: string | null; name?: string | null }>()
const initial = computed(() => {
  const n = String(props.name || '').trim()
  return n ? n[0].toUpperCase() : 'U'
})
</script>

<template>
  <span class="grid place-items-center overflow-hidden bg-ink text-bg font-semibold select-none">
    <img v-if="src" :src="src" alt="" class="h-full w-full object-cover" />
    <template v-else>{{ initial }}</template>
  </span>
</template>
