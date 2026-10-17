<script setup lang="ts">
import { computed, onMounted } from 'vue'

const { groups, activeCat, selectCat } = useNav()
const { categories, loadCategories } = useCategories()

onMounted(() => loadCategories())

const list = computed(() => {
  const seen = new Set(groups.value.map((g) => g.name))
  const out = groups.value.map((g) => ({ key: g.id, name: g.name }))
  for (const name of categories.value) {
    if (!seen.has(name)) out.push({ key: name, name })
  }
  return out
})
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
      v-for="item in list"
      :key="item.key"
      class="shrink-0 h-8 px-3.5 rounded-full text-[13px] font-medium border transition-colors"
      :class="activeCat === item.key ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
      @click="selectCat(item.key)"
    >
      {{ item.name }}
    </button>
  </div>
</template>
