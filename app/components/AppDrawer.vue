<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'

const open = useState<boolean>('nav-drawer-open', () => false)
const { groups, activeCat, selectCat } = useNav()
const { user } = useAuth()
const { mode, setMode, isMobile } = useDevice()

const friendLinks = useState<{ name: string; url: string; desc?: string }[]>('nav-friends', () => [])

function pickCat(id: string | null) {
  selectCat(id)
  open.value = false
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
        <span class="grid place-items-center w-8 h-8 rounded-xl bg-ink text-bg text-[11px] font-mono font-bold">2077</span>
        <span class="font-semibold text-[14px]">2077 导航</span>
        <div class="flex-1" />
        <button class="grid place-items-center w-8 h-8 rounded-lg text-ink2 hover:bg-card2" aria-label="关闭" @click="open = false">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        <WeatherCard />

        <NuxtLink v-if="user?.is_admin" to="/admin" class="flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z" /></svg>
          管理后台
        </NuxtLink>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <span class="h-3.5 w-1 rounded-full accent-bar" />
            <span class="text-[13px] font-semibold">显示模式</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="opt in [{ v: 'auto', t: '跟随设备' }, { v: 'pc', t: '电脑版' }, { v: 'mobile', t: '手机版' }]"
              :key="opt.v"
              class="h-9 rounded-xl text-[12.5px] border transition-colors"
              :class="mode === opt.v ? 'bg-ink text-bg border-transparent font-medium' : 'bg-card border-line text-ink2 hover:text-ink'"
              @click="setMode(opt.v as any)"
            >
              {{ opt.t }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <span class="h-3.5 w-1 rounded-full accent-bar" />
            <span class="text-[13px] font-semibold">分类</span>
          </div>
          <div class="flex flex-col gap-1">
            <button
              class="flex items-center justify-between h-10 px-3 rounded-xl text-[13.5px] transition-colors"
              :class="activeCat === null ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:bg-card2 hover:text-ink'"
              @click="pickCat(null)"
            >
              <span>全部</span>
              <span class="text-[11.5px] opacity-60">{{ groups.length }}</span>
            </button>
            <button
              v-for="g in groups"
              :key="g.id"
              class="flex items-center justify-between h-10 px-3 rounded-xl text-[13.5px] transition-colors"
              :class="activeCat === g.id ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:bg-card2 hover:text-ink'"
              @click="pickCat(g.id)"
            >
              <span class="truncate">{{ g.name }}</span>
              <span class="text-[11.5px] opacity-60">{{ g.links.length }}</span>
            </button>
          </div>
        </div>

        <div v-if="friendLinks.length" class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <span class="h-3.5 w-1 rounded-full accent-bar" />
            <span class="text-[13px] font-semibold">友情链接</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <a
              v-for="f in friendLinks"
              :key="f.url"
              :href="f.url"
              target="_blank"
              rel="noopener nofollow"
              class="inline-flex items-center h-8 px-3 rounded-lg bg-card border border-line text-[12.5px] text-ink2 hover:text-ink"
            >{{ f.name }}</a>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
