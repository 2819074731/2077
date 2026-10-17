<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ page: number; total: number; size: number }>()
const emit = defineEmits<{ change: [page: number] }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.size)))
const pages = computed(() => {
  const n = totalPages.value
  const start = Math.max(1, Math.min(props.page - 2, n - 4))
  const end = Math.min(n, start + 4)
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
})
</script>

<template>
  <div v-if="totalPages > 1" class="flex items-center justify-center gap-1.5 mt-5 flex-wrap">
    <button class="btn btn-sm" :disabled="page <= 1" @click="emit('change', page - 1)">上一页</button>
    <button
      v-for="p in pages"
      :key="p"
      class="btn btn-sm min-w-[32px]"
      :class="p === page ? 'btn-primary' : 'btn-ghost'"
      @click="emit('change', p)"
    >{{ p }}</button>
    <button class="btn btn-sm" :disabled="page >= totalPages" @click="emit('change', page + 1)">下一页</button>
  </div>
</template>
