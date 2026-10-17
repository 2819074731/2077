<script setup lang="ts">
const colorMode = useColorMode()
const { user, restore } = useAuth()
const { diy, toggleDiy, loadLocal, syncMsg } = useNav()

const drawerOpen = useState<boolean>('nav-drawer-open', () => false)

onMounted(() => {
  loadLocal()
  restore()
})

const isDark = computed(() => colorMode.value === 'dark')
</script>

<template>
  <div class="relative min-h-screen flex flex-col">
    <div class="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-60" />

    <header class="sticky top-0 z-30 border-b border-line bg-header backdrop-blur-xl">
      <div class="max-w-wrap mx-auto px-4 h-14 flex items-center gap-1.5 sm:gap-2">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold shrink-0" aria-label="2077 导航">
          <span class="grid place-items-center w-8 h-8 rounded-xl bg-ink text-bg text-[11px] font-mono font-bold tracking-tight">2077</span>
          <span class="hidden sm:inline text-[15px] tracking-tight">2077 导航</span>
        </NuxtLink>

        <span v-if="syncMsg" class="hidden lg:inline text-[12px] text-ink2 ml-1.5">{{ syncMsg }}</span>

        <div class="flex-1" />

        <!-- PC：头部天气 -->
        <ClientOnly>
          <WeatherCard compact class="hidden lg:flex" />
          <template #fallback>
            <div class="hidden lg:block w-[168px] h-[44px] card animate-pulse" />
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

        <button class="btn btn-sm btn-ghost btn-icon-sm hidden sm:inline-flex" title="切换主题" aria-label="切换主题" @click="colorMode.preference = isDark ? 'light' : 'dark'">
          <svg v-if="isDark" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
        </button>

        <NuxtLink v-if="user?.is_admin" to="/admin" class="btn btn-sm btn-ghost btn-icon-sm hidden sm:inline-flex" title="管理后台" aria-label="管理后台">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z" /></svg>
        </NuxtLink>

        <NuxtLink v-if="!user" to="/login" class="btn btn-sm hidden sm:inline-flex">登录</NuxtLink>
        <NuxtLink v-else to="/settings" class="btn btn-sm !px-1.5 hidden sm:inline-flex" :title="user.nickname" aria-label="我的设置">
          <span class="grid place-items-center w-6 h-6 rounded-full bg-ink text-bg text-[11px] font-semibold">{{ (user.nickname || 'U')[0].toUpperCase() }}</span>
        </NuxtLink>

        <!-- 手机：抽屉菜单 -->
        <button class="btn btn-sm btn-ghost btn-icon-sm sm:hidden" title="菜单" aria-label="菜单" @click="drawerOpen = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-line mt-14">
      <div class="max-w-wrap mx-auto px-4 py-6 text-xs text-ink2 flex items-center gap-3 flex-wrap">
        <span class="font-medium text-ink">2077 导航</span>
        <span class="opacity-40">·</span>
        <NuxtLink to="/submit" class="hover:text-ink">提交收录</NuxtLink>
        <div class="flex-1" />
        <SetHomeHint />
      </div>
    </footer>

    <AppDrawer />
  </div>
</template>
