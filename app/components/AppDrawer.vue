<script setup lang="ts">
import { computed } from 'vue'
import { iconFor, hostOf, INLINE_GROUP_COUNT } from '~/data/nav'

const open = useState<boolean>('nav-drawer-open', () => false)
const colorMode = useColorMode()
const { groups, recordClick } = useNav()
const { user } = useAuth()

const overflowGroups = computed(() => groups.value.slice(INLINE_GROUP_COUNT))
const isDark = computed(() => colorMode.value === 'dark')

function go(url: string, name = '') {
  recordClick(url, name)
  open.value = false
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 lg:hidden">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="open = false" />
    <aside class="absolute inset-y-0 right-0 w-[86%] max-w-[340px] bg-bg border-l border-line flex flex-col animate-fade-up">
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

        <div class="flex flex-col gap-1.5">
          <NuxtLink to="/submit" class="flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
            提交收录
          </NuxtLink>
          <NuxtLink v-if="user?.is_admin" to="/admin" class="flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z" /></svg>
            管理后台
          </NuxtLink>
          <NuxtLink v-if="!user" to="/login" class="flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
            登录同步
          </NuxtLink>
          <NuxtLink v-else to="/settings" class="flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
            我的设置
          </NuxtLink>
          <button class="flex items-center gap-2.5 h-10 px-3 rounded-xl text-[13.5px] text-ink2 hover:bg-card2 hover:text-ink text-left" @click="colorMode.preference = isDark ? 'light' : 'dark'">
            <svg v-if="isDark" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
            {{ isDark ? '切换浅色' : '切换深色' }}
          </button>
        </div>

        <div v-if="overflowGroups.length" class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <span class="h-3.5 w-1 rounded-full accent-bar" />
            <span class="text-[13px] font-semibold">更多分类</span>
          </div>
          <div v-for="g in overflowGroups" :key="g.id" class="flex flex-col gap-2">
            <span class="text-[12px] text-ink2">{{ g.name }}</span>
            <div class="grid grid-cols-3 gap-2">
              <a
                v-for="l in g.links"
                :key="l.id"
                :href="l.url"
                target="_blank"
                rel="noopener"
                class="flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-card border border-line text-center"
                @click="go(l.url, l.name)"
              >
                <img :src="iconFor(l.url)" :alt="l.name" class="w-5 h-5 object-contain" loading="lazy" referrerpolicy="no-referrer" />
                <span class="text-[11px] text-ink2 leading-tight line-clamp-2 px-1">{{ l.name }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
