<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const stats = ref<any>(null)
const recent = ref<any[]>([])
const loading = ref(true)

useSeoMeta({ title: '数据概览 · 2077 管理后台', robots: 'noindex' })

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
  { key: 'users', label: '注册用户', to: '/admin/users', tone: 'text-ink' },
  { key: 'links', label: '云端网址', to: '/admin/users', tone: 'text-ink' },
  { key: 'pending', label: '待审核收录', to: '/admin/submissions', tone: 'text-warning' },
  { key: 'approved', label: '已收录提交', to: '/admin/submissions', tone: 'text-success' },
  { key: 'directory', label: '目录站点', to: '/admin/directory', tone: 'text-ink' },
  { key: 'todayUv', label: '今日访客', to: '/admin/stats', tone: 'text-ink' },
  { key: 'todayPv', label: '今日浏览量', to: '/admin/stats', tone: 'text-ink' },
  { key: 'todayBot', label: '今日蜘蛛', to: '/admin/stats', tone: 'text-ink2' }
]

const actions = [
  { to: '/admin/submissions', label: '审核收录', desc: '处理待审核站点' },
  { to: '/admin/nav', label: '编辑导航', desc: '首页分组与推荐' },
  { to: '/admin/directory', label: '管理目录', desc: '独立详情页站点' },
  { to: '/admin/discover', label: '发现链接', desc: '从链接页批量采集' }
]

function statusText(s: string) {
  return s === 'pending' ? '待审核' : s === 'approved' ? '已收录' : '已拒绝'
}
</script>

<template>
  <div class="animate-fade-up">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <NuxtLink v-for="c in cards" :key="c.key" :to="c.to" class="card p-4 hover:border-ink/25 transition-colors">
        <div class="text-ink2 text-[12px]">{{ c.label }}</div>
        <div class="text-[24px] font-semibold mt-1" :class="c.tone">{{ loading ? '—' : (stats?.[c.key] ?? 0) }}</div>
      </NuxtLink>
    </div>

    <section class="mb-5">
      <h2 class="font-semibold text-[14px] mb-2.5">快捷操作</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <NuxtLink v-for="a in actions" :key="a.to" :to="a.to" class="card p-3.5 hover:border-ink/25 transition-colors">
          <div class="text-[13.5px] font-medium">{{ a.label }}</div>
          <div class="text-[11.5px] text-ink2 mt-0.5">{{ a.desc }}</div>
        </NuxtLink>
      </div>
    </section>

    <section class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-line flex items-center gap-2">
        <h2 class="font-semibold text-[14px]">最新收录提交</h2>
        <div class="flex-1" />
        <NuxtLink to="/admin/submissions" class="btn btn-sm btn-ghost">查看全部</NuxtLink>
      </div>
      <div v-if="loading" class="p-6 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else-if="!recent.length" class="p-6 text-center text-ink2 text-[13px]">暂无提交</div>
      <div v-else class="divide-y divide-line">
        <div v-for="r in recent" :key="r.id" class="flex items-center gap-3 px-4 py-2.5">
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-medium truncate">{{ r.name }}</span>
            <span class="block text-[11.5px] text-ink2 truncate">{{ r.url }}</span>
          </span>
          <span class="chip shrink-0" :class="{ 'text-warning': r.status === 'pending' }">{{ statusText(r.status) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
