<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ src?: string | null; name?: string | null }>()
const failed = ref(false)
const initial = computed(() => {
  const n = String(props.name || '').trim()
  return n ? n[0].toUpperCase() : 'U'
})
const show = computed(() => !!props.src && !failed.value)

watch(() => props.src, () => (failed.value = false))
</script>

<template>
  <span class="grid place-items-center overflow-hidden bg-ink text-bg font-semibold select-none">
    <img
      v-if="show"
      :src="props.src!"
      alt=""
      class="h-full w-full object-cover"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <template v-else>{{ initial }}</template>
  </span>
</template>
