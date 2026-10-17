<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const stats = ref<any>(null)
const recent = ref<any[]>([])
const loading = ref(true)

useSeoMeta({ title: '概览 · 2077 管理后台', robots: 'noindex' })

onMounted(async () => {
  try {
    const d: any = await $fetch('/api/admin/stats')
    stats.value = d.stats
    recent.value = d.recent || []
  } finally {
    loading.value = false
  }
})

const cards = [
  { key: 'users', label: '注册用户', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { key: 'links', label: '云端网址', icon: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1' },
  { key: 'pending', label: '待审核收录', icon: 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z' },
  { key: 'approved', label: '已收录', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' }
]
</script>

<template>
  <div class="animate-fade-up">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      <div v-for="c in cards" :key="c.key" class="card p-4">
        <div class="flex items-center gap-2 text-ink2 text-[12.5px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="c.icon" /></svg>
          {{ c.label }}
        </div>
        <div class="text-[26px] font-semibold mt-1.5">{{ loading ? '—' : (stats?.[c.key] ?? 0) }}</div>
      </div>
    </div>

    <section class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-line flex items-center gap-2">
        <h2 class="font-semibold text-[14px]">最新收录提交</h2>
        <div class="flex-1" />
        <NuxtLink to="/admin/submissions" class="btn btn-sm btn-ghost">全部</NuxtLink>
      </div>
      <div v-if="!recent.length" class="p-6 text-center text-ink2 text-[13px]">暂无提交</div>
      <div v-else class="divide-y divide-line">
        <div v-for="r in recent" :key="r.id" class="flex items-center gap-3 px-4 py-2.5">
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-medium truncate">{{ r.name }}</span>
            <span class="block text-[11.5px] text-ink2 truncate">{{ r.url }}</span>
          </span>
          <span class="chip shrink-0" :class="{ 'text-warning': r.status === 'pending' }">{{ r.status }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
