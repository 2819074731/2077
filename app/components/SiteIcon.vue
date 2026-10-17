<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ src?: string | null; name?: string | null; url?: string | null }>()
const failed = ref(false)

watch(() => props.src, () => (failed.value = false))

const host = computed(() => {
  try { return new URL(String(props.url || '')).hostname } catch { return '' }
})
const label = computed(() => {
  const n = String(props.name || '').trim()
  const v = n || host.value || '?'
  return v[0].toUpperCase()
})
const hue = computed(() => {
  const seed = String(props.name || '') + String(props.url || '')
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
})
const fallbackStyle = computed(() => ({
  background: `hsl(${hue.value} 60% 92%)`,
  color: `hsl(${hue.value} 45% 32%)`
}))
const show = computed(() => !!props.src && !failed.value)
</script>

<template>
  <span class="grid place-items-center overflow-hidden bg-card2 border border-line" :style="show ? undefined : fallbackStyle">
    <img
      v-if="show"
      :src="props.src!"
      :alt="name || ''"
      class="h-full w-full object-contain p-[18%]"
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else class="font-semibold leading-none">{{ label }}</span>
  </span>
</template>
