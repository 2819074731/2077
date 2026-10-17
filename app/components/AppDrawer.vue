<script setup lang="ts">
import { watch, onBeforeUnmount, computed } from 'vue'

const open = useState<boolean>('nav-drawer-open', () => false)
const wpSettingsOpen = useState<boolean>('wp-settings-open', () => false)
const { groups, activeCat, selectCat } = useNav()
const { user } = useAuth()
const { isMobile } = useDevice()

const totalLinks = computed(() => groups.value.reduce((n, g) => n + g.links.length, 0))

function pickCat(id: string | null) {
  selectCat(id)
  open.value = false
}

function goHome() {
  selectCat(null)
  open.value = false
}

function openSettings() {
  open.value = false
  wpSettingsOpen.value = true
}

function lockBody(locked: boolean) {
  if (!import.meta.client) return
  document.documentElement.style.overflow = locked ? 'hidden' : ''
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(open, (v) => lockBody(v && isMobile.value))
onBeforeUnmount(() => lockBody(false))
</script>

<template>
  <div v-if="open && isMobile" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="open = false" @touchmove.prevent />
    <aside class="absolute inset-y-0 right-0 w-[86%] max-w-[340px] bg-bg border-l border-line flex flex-col animate-fade-up" @touchmove.stop>
      <div class="h-14 flex items-center gap-2 px-4 border-b border-line shrink-0">
        <NuxtLink to="/" class="flex items-center gap-2 min-w-0" aria-label="返回首页" @click="goHome">
          <span class="grid place-items-center w-8 h-8 rounded-xl bg-ink text-bg text-[11px] font-mono font-bold">2077</span>
          <span class="font-semibold text-[14px] truncate">2077 导航</span>
        </NuxtLink>
        <div class="flex-1" />
        <button class="grid place-items-center w-8 h-8 rounded-lg text-ink2 hover:bg-card2" aria-label="关闭" @click="open = false">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto overscroll-contain p-4 flex flex-col gap-5">
        <WeatherCard variant="panel" />

        <div class="grid grid-cols-2 gap-2">
          <button class="flex items-center gap-2 h-10 px-3 rounded-xl bg-card2/60 border border-line text-[13px] text-ink2 hover:bg-card2 hover:text-ink text-left" @click="openSettings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-5 4 4 3-3 4 4" /></svg>
            外观设置
          </button>
          <NuxtLink v-if="user?.is_admin" to="/admin" class="flex items-center gap-2 h-10 px-3 rounded-xl bg-card2/60 border border-line text-[13px] text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z" /></svg>
            管理后台
          </NuxtLink>
        </div>

        <section class="flex flex-col gap-2.5">
          <div class="flex items-center gap-2">
            <span class="h-3.5 w-1 rounded-full accent-bar" />
            <span class="text-[13px] font-semibold">分类</span>
            <span class="ml-auto text-[11px] text-ink3">共 {{ groups.length }} 个</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              class="col-span-2 flex items-center justify-between h-10 px-3 rounded-xl text-[13px] transition-colors"
              :class="activeCat === null ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:bg-card2 hover:text-ink'"
              @click="pickCat(null)"
            >
              <span class="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
                全部站点
              </span>
              <span class="text-[11px] opacity-60">{{ totalLinks }}</span>
            </button>
            <button
              v-for="g in groups"
              :key="g.id"
              class="flex items-center justify-between gap-1.5 h-10 px-3 rounded-xl text-[13px] transition-colors"
              :class="activeCat === g.id ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:bg-card2 hover:text-ink'"
              @click="pickCat(g.id)"
            >
              <span class="truncate">{{ g.name }}</span>
              <span class="text-[11px] opacity-60 shrink-0">{{ g.links.length }}</span>
            </button>
          </div>
        </section>
      </div>

      <div class="shrink-0 border-t border-line bg-bg/95 backdrop-blur px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <NuxtLink
          to="/site"
          class="flex items-center gap-3 h-12 px-3 rounded-xl border border-line bg-card2/60 hover:bg-card2 transition-colors"
          @click="open = false"
        >
          <span class="grid place-items-center w-8 h-8 rounded-lg bg-accentsoft text-accent shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" /></svg>
          </span>
          <span class="min-w-0">
            <span class="block text-[13.5px] font-medium leading-tight">分类目录</span>
            <span class="block text-[11px] text-ink3 leading-tight mt-0.5">浏览全部收录站点</span>
          </span>
          <svg class="ml-auto text-ink3 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>
        </NuxtLink>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <NuxtLink to="/sitemap" class="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12.5px] text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
            站点地图
          </NuxtLink>
          <NuxtLink to="/submit" class="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12.5px] text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
            提交收录
          </NuxtLink>
        </div>
      </div>
    </aside>
  </div>
</template>
