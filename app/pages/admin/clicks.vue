<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const top = ref<any[]>([])
const recent = ref<any[]>([])
const stats = ref<{ total: number; today: number }>({ total: 0, today: 0 })
const daily = ref<{ d: string; n: number }[]>([])
const loading = ref(true)

useSeoMeta({ title: '点击统计 · 2077 管理后台', robots: 'noindex' })

const maxDaily = computed(() => Math.max(1, ...daily.value.map((d) => d.n)))

onMounted(async () => {
  try {
    const d: any = await $fetch('/api/admin/clicks')
    top.value = d.top || []
    recent.value = d.recent || []
    stats.value = d.stats || stats.value
    daily.value = d.daily || []
  } finally {
    loading.value = false
  }
})

function fmt(ts: string) {
  try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }) } catch { return ts }
}
</script>

<template>
  <div class="animate-fade-up">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      <div class="card p-4">
        <div class="text-ink2 text-[12.5px]">总点击</div>
        <div class="text-[26px] font-semibold mt-1.5">{{ loading ? '—' : stats.total }}</div>
      </div>
      <div class="card p-4">
        <div class="text-ink2 text-[12.5px]">今日点击</div>
        <div class="text-[26px] font-semibold mt-1.5">{{ loading ? '—' : stats.today }}</div>
      </div>
      <div class="card p-4 col-span-2">
        <div class="text-ink2 text-[12.5px] mb-2">近 7 天趋势</div>
        <div class="flex items-end gap-1 h-10">
          <span
            v-for="(d, i) in daily"
            :key="i"
            class="flex-1 rounded-sm bg-ink"
            :style="{ height: Math.max(8, (d.n / maxDaily) * 100) + '%' }"
            :title="d.d + ' · ' + d.n"
          />
        </div>
      </div>
    </div>

    <section class="card overflow-hidden mb-5">
      <div class="px-4 py-3 border-b border-line flex items-center gap-2">
        <h2 class="font-semibold text-[14px]">热门站点 Top 50</h2>
      </div>
      <div v-if="loading" class="p-6 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else-if="!top.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
      <div v-else class="divide-y divide-line">
        <div v-for="(r, i) in top" :key="r.url" class="flex items-center gap-3 px-4 py-2.5">
          <span class="w-6 text-[12.5px] text-ink3 text-right">{{ i + 1 }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-medium truncate">{{ r.name || r.url }}</span>
            <span class="block text-[11.5px] text-ink2 truncate">{{ r.url }}</span>
          </span>
          <span class="chip shrink-0">{{ r.hits }} 次</span>
        </div>
      </div>
    </section>

    <section class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-line">
        <h2 class="font-semibold text-[14px]">最近点击</h2>
      </div>
      <div v-if="!recent.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
      <div v-else class="divide-y divide-line">
        <div v-for="(r, i) in recent" :key="i" class="flex items-center gap-3 px-4 py-2">
          <span class="min-w-0 flex-1 text-[13px] truncate">{{ r.name || r.url }}</span>
          <span class="text-[11.5px] text-ink2 shrink-0">{{ fmt(r.created_at) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
