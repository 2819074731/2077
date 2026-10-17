<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const { user, restore } = useAuth()
const route = useRoute()
const menuOpen = ref(false)

onMounted(async () => {
  await restore()
})

const menus = [
  {
    label: '概览',
    items: [
      { to: '/admin', label: '数据概览', exact: true, icon: 'M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z' }
    ]
  },
  {
    label: '内容管理',
    items: [
      { to: '/admin/submissions', label: '收录审核', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
      { to: '/admin/nav', label: '导航管理', icon: 'M4 6h16M4 12h16M4 18h16' },
      { to: '/admin/directory', label: '分类目录', icon: 'M4 5h16v14H4zM4 10h16M10 10v9' },
      { to: '/admin/discover', label: '链接发现', icon: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35' }
    ]
  },
  {
    label: '用户与运营',
    items: [
      { to: '/admin/users', label: '用户管理', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm14 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
      { to: '/admin/friends', label: '友情链接', icon: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1' }
    ]
  },
  {
    label: '数据统计',
    items: [
      { to: '/admin/stats', label: '流量与蜘蛛', icon: 'M3 3v18h18M7 15l3-3 3 3 5-6' }
    ]
  }
]

const current = computed(() => {
  for (const g of menus) {
    const found = g.items.find(i => (i.exact ? route.path === i.to : route.path.startsWith(i.to)))
    if (found) return found.label
  }
  return '后台'
})

function isActive(i: any) {
  return i.exact ? route.path === i.to : route.path.startsWith(i.to)
}
</script>

<template>
  <div class="min-h-screen flex bg-bg">
    <aside
      class="fixed lg:static inset-y-0 left-0 z-40 w-64 border-r border-line bg-card flex flex-col transition-transform duration-200 lg:translate-x-0"
      :class="menuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-14 flex items-center gap-2 px-4 border-b border-line shrink-0">
        <span class="grid place-items-center w-8 h-8 rounded-xl bg-ink text-bg text-[10px] font-mono font-bold">2077</span>
        <span class="font-semibold text-[14px]">管理后台</span>
        <button class="lg:hidden ml-auto grid place-items-center w-9 h-9 rounded-lg text-ink2 hover:bg-card2" aria-label="关闭菜单" @click="menuOpen = false">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <nav class="p-2.5 flex flex-col gap-3 overflow-y-auto">
        <div v-for="g in menus" :key="g.label">
          <p class="px-3 mb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink3">{{ g.label }}</p>
          <div class="flex flex-col gap-0.5">
            <NuxtLink
              v-for="i in g.items"
              :key="i.to"
              :to="i.to"
              class="flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] font-medium transition-colors"
              :class="isActive(i) ? 'bg-ink text-bg' : 'text-ink2 hover:bg-card2 hover:text-ink'"
              @click="menuOpen = false"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="i.icon" /></svg>
              {{ i.label }}
            </NuxtLink>
          </div>
        </div>
      </nav>
      <div class="mt-auto p-2.5 border-t border-line">
        <NuxtLink to="/" class="flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] text-ink2 hover:bg-card2 hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
          返回前台
        </NuxtLink>
      </div>
    </aside>

    <div v-if="menuOpen" class="fixed inset-0 z-30 bg-black/40 lg:hidden" @click="menuOpen = false" />

    <div class="flex-1 min-w-0 flex flex-col">
      <header class="sticky top-0 z-20 h-14 flex items-center gap-3 px-3 sm:px-4 border-b border-line bg-header backdrop-blur-xl">
        <button class="lg:hidden grid place-items-center w-9 h-9 rounded-xl border border-line bg-card" aria-label="打开菜单" @click="menuOpen = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 class="font-semibold text-[15px] truncate">{{ current }}</h1>
        <div class="flex-1" />
        <NuxtLink to="/settings" class="btn btn-sm !px-1.5" :title="user?.nickname || ''">
          <span class="grid place-items-center w-6 h-6 rounded-full bg-ink text-bg text-[11px] font-semibold">{{ (user?.nickname || 'A')[0].toUpperCase() }}</span>
        </NuxtLink>
      </header>
      <main class="p-3 sm:p-5 lg:p-6 max-w-[1280px] w-full mx-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
