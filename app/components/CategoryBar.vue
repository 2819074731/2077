<script setup lang="ts">
import { computed } from 'vue'

const { groups, activeCat, selectCat } = useNav()
const list = computed(() => groups.value)
</script>

<template>
  <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-5 -mx-1 px-1">
    <button
      class="shrink-0 h-8 px-3.5 rounded-full text-[13px] font-medium border transition-colors"
      :class="activeCat === null ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
      @click="selectCat(null)"
    >
      全部
    </button>
    <button
      v-for="g in list"
      :key="g.id"
      class="shrink-0 h-8 px-3.5 rounded-full text-[13px] font-medium border transition-colors"
      :class="activeCat === g.id ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
      @click="selectCat(g.id)"
    >
      {{ g.name }}
    </button>
  </div>
</template>
