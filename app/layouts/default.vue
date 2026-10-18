<script setup lang="ts">
import { useWallpaper } from '~/composables/useWallpaper'

const colorMode = useColorMode()
const { user, restore } = useAuth()
const { diy, toggleDiy, loadLocal, syncMsg, selectCat, bookmarks } = useNav()
const { loadCategories } = useCategories()
const { isMobile, initServer, initClient } = useDevice()
const wp = useWallpaper()
const { settings, loadSiteSettings } = useSiteSettings()
await loadSiteSettings()

const drawerOpen = useState<boolean>('nav-drawer-open', () => false)
const wpSettingsOpen = useState<boolean>('wp-settings-open', () => false)
const friendLinks = useState<{ name: string; url: string; desc?: string }[]>('nav-friends', () => [])
const { data: friendsData } = await useFetch('/api/friends', { key: 'friends-fetch', default: () => ({ links: [] }) })
watchEffect(() => {
  const links = (friendsData.value as any)?.links
  if (Array.isArray(links)) friendLinks.value = links
})

initServer()

onMounted(() => {
  initClient()
  loadLocal()
  loadCategories()
  wp.loadLocal()
  restore()
})

const isDark = computed(() => colorMode.value === 'dark')

function goHome() {
  selectCat(null)
  drawerOpen.value = false
}
</script>

<template>
  <div
    class="relative min-h-screen flex flex-col"
    :class="[{ 'wp-on': wp.active.value }, wp.active.value ? `wp-tone-${wp.tone.value}` : '']"
  >
    <LazyWallpaperLayer v-if="wp.active.value" />
    <div v-if="!wp.active.value" class="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-60" />

    <header class="sticky top-0 z-30 border-b border-line bg-header backdrop-blur-xl">
      <div class="max-w-wrap mx-auto px-4 h-14 flex items-center gap-1.5 sm:gap-2">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold shrink-0" :aria-label="settings.siteName" @click="goHome">
          <span class="grid place-items-center w-8 h-8 rounded-xl bg-ink text-bg text-[11px] font-mono font-bold tracking-tight">{{ settings.siteShortName }}</span>
          <span v-if="!isMobile" class="text-[15px] tracking-tight">{{ settings.siteName }}</span>
        </NuxtLink>

        <span v-if="syncMsg && !isMobile" class="text-[12px] text-ink2 ml-1.5">{{ syncMsg }}</span>

        <div class="flex-1" />

        <!-- PC：头部天气 -->
        <ClientOnly>
          <template v-if="!isMobile">
            <LazyWeatherCard variant="header" />
          </template>
          <template #fallback>
            <div v-if="!isMobile" class="w-[120px] h-9 rounded-xl bg-card2 animate-pulse" />
          </template>
        </ClientOnly>

        <button
          class="btn btn-sm btn-icon-sm"
          :class="{ 'btn-primary': diy }"
          :title="diy ? '退出编辑' : '自定义导航'"
          :aria-label="diy ? '退出编辑' : '自定义导航'"
          @click="toggleDiy"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </button>

        <button
          class="btn btn-sm btn-ghost btn-icon-sm"
          :class="{ 'btn-primary': wp.active.value }"
          title="外观设置"
          aria-label="外观设置"
          @click="wpSettingsOpen = true"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-5 4 4 3-3 4 4" /></svg>
        </button>

        <button class="btn btn-sm btn-ghost btn-icon-sm" title="切换主题" aria-label="切换主题" @click="colorMode.preference = isDark ? 'light' : 'dark'">
          <svg v-if="isDark" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
        </button>

        <NuxtLink v-if="user?.is_admin && !isMobile" to="/admin" class="btn btn-sm btn-ghost btn-icon-sm" title="管理后台" aria-label="管理后台">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z" /></svg>
        </NuxtLink>

        <NuxtLink to="/bookmarks" class="btn btn-sm btn-ghost btn-icon-sm relative" :title="`我的收藏（${bookmarks.length}）`" aria-label="我的收藏">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>
          <span v-if="bookmarks.length" class="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-accent text-white text-[9px] leading-[14px] text-center font-medium">{{ bookmarks.length > 99 ? '99+' : bookmarks.length }}</span>
        </NuxtLink>

        <NuxtLink v-if="!user" to="/login" class="btn btn-sm btn-ghost btn-icon-sm" title="登录" aria-label="登录">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
        </NuxtLink>
        <NuxtLink v-else to="/settings" class="btn btn-sm !px-1.5" :title="user.nickname" aria-label="我的设置">
          <UserAvatar :src="user.avatar" :name="user.nickname" class="w-6 h-6 rounded-full text-[11px]" />
        </NuxtLink>

        <!-- 手机：抽屉菜单 -->
        <button v-if="isMobile" class="btn btn-sm btn-ghost btn-icon-sm" title="菜单" aria-label="菜单" @click="drawerOpen = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-line mt-14">
      <div class="max-w-wrap mx-auto px-4 py-6 text-xs text-ink2 flex flex-col gap-4">
        <div v-if="friendLinks.length" class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span class="text-ink font-medium">友情链接</span>
          <a
            v-for="f in friendLinks"
            :key="f.url"
            :href="f.url"
            target="_blank"
            rel="noopener nofollow"
            class="hover:text-ink"
            :title="f.desc || f.name"
          >{{ f.name }}</a>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <span class="font-medium text-ink">{{ settings.siteName }}</span>
          <span class="opacity-40">·</span>
          <NuxtLink to="/site" class="hover:text-ink">分类目录</NuxtLink>
          <span class="opacity-40">·</span>
          <NuxtLink to="/bookmarks" class="hover:text-ink">我的收藏</NuxtLink>
          <span class="opacity-40">·</span>
          <NuxtLink to="/sitemap" class="hover:text-ink">站点地图</NuxtLink>
          <span class="opacity-40">·</span>
          <NuxtLink to="/submit" class="hover:text-ink">提交收录</NuxtLink>
          <template v-if="settings.icpNumber">
            <span class="opacity-40">·</span>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener nofollow" class="hover:text-ink">{{ settings.icpNumber }}</a>
          </template>
          <template v-if="settings.contactEmail">
            <span class="opacity-40">·</span>
            <a :href="`mailto:${settings.contactEmail}`" class="hover:text-ink">联系</a>
          </template>
        </div>
      </div>
    </footer>

    <AppDrawer />
    <LazyWallpaperSettings v-if="wpSettingsOpen" />
  </div>
</template>
