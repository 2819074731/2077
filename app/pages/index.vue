<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { DEFAULT_GROUPS, INLINE_GROUP_COUNT } from '~/data/nav'

const { groups, diy, syncMsg, loadLocal, addGroup, resetAll } = useNav()
const { user, refresh } = useAuth()

onMounted(async () => {
  loadLocal()
  await refresh()
  loadLocal()
})

const siteUrl = useRuntimeConfig().public.siteUrl

useSeoMeta({
  title: '2077 导航 · 可自定义的浏览器起始页',
  description: '2077 导航：可自定义的浏览器起始页，聚合常用站点，支持离线使用与云端同步。',
  ogTitle: '2077 导航',
  ogDescription: '可自定义的浏览器起始页，聚合常用站点导航。',
  ogType: 'website',
  ogUrl: siteUrl + '/'
})

useHead({
  link: [{ rel: 'canonical', href: siteUrl + '/' }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '2077 导航',
      url: siteUrl + '/',
      potentialAction: {
        '@type': 'SearchAction',
        target: siteUrl + '/?q={search_term_string}',
        'query-input': 'required name=search_term_string'
      }
    })
  }]
})

const totalLinks = computed(() => groups.value.reduce((n, g) => n + g.links.length, 0))
const inlineGroups = computed(() => groups.value.slice(0, INLINE_GROUP_COUNT))
const hasMoreGroups = computed(() => groups.value.length > INLINE_GROUP_COUNT)
const drawerOpen = useState<boolean>('nav-drawer-open', () => false)
function openDrawer() { drawerOpen.value = true }
</script>

<template>
  <div class="max-w-wrap mx-auto px-4">
    <section class="pt-12 sm:pt-16 pb-8 flex flex-col items-center text-center gap-4">
      <h1 class="text-[30px] sm:text-[40px] font-extrabold tracking-tight leading-[1.1]">
        2077 导航
      </h1>
      <div class="w-full max-w-[680px]">
        <SearchBar />
      </div>
      <div class="flex items-center gap-3 text-[12px] text-ink2 flex-wrap justify-center">
        <span>{{ groups.length }} 个分类</span>
        <span class="opacity-40">·</span>
        <span>{{ totalLinks }} 个站点</span>
        <span class="opacity-40">·</span>
        <NuxtLink to="/submit" class="text-ink hover:underline">提交收录</NuxtLink>
        <NuxtLink v-if="!user" to="/login" class="text-ink hover:underline">登录同步</NuxtLink>
        <NuxtLink v-else to="/settings" class="text-ink hover:underline">管理导航</NuxtLink>
      </div>
    </section>

    <div v-if="diy" class="card px-4 py-3 mb-7 flex items-center gap-3 text-[13px] animate-fade-up flex-wrap">
      <span class="grid place-items-center w-6 h-6 rounded-lg bg-card2 text-ink shrink-0">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      </span>
      <span class="text-ink2">编辑模式：修改名称、增删链接与分组，登录后自动同步到云端。</span>
      <div class="flex-1" />
      <span v-if="syncMsg" class="text-ink2 hidden sm:inline">{{ syncMsg }}</span>
      <button class="btn btn-sm" @click="addGroup">+ 分组</button>
      <button class="btn btn-sm" @click="resetAll">恢复默认</button>
    </div>

    <ClientOnly>
      <div class="animate-fade-up">
        <FrequentLinks />
        <LinkGroup v-for="g in inlineGroups" :key="g.id" :group="g" />
      </div>
      <template #fallback>
        <div>
          <LinkGroup v-for="g in DEFAULT_GROUPS.slice(0, INLINE_GROUP_COUNT)" :key="g.id" :group="g" />
        </div>
      </template>
    </ClientOnly>

    <div v-if="hasMoreGroups" class="text-center mb-8">
      <button class="btn btn-sm lg:hidden" @click="openDrawer">查看全部 {{ groups.length }} 个分类</button>
      <span class="hidden lg:inline text-[12.5px] text-ink2">
        更多分类（{{ groups.length - INLINE_GROUP_COUNT }} 个）已收起，点击右上角「自定义」可编辑。
      </span>
    </div>

    <p v-if="user" class="text-[12px] text-ink2 mb-10 text-center">
      已登录 {{ user.nickname }}，配置已开启云端同步。
    </p>
    <p v-else class="text-[12px] text-ink2 mb-10 text-center">
      <NuxtLink to="/login" class="text-ink hover:underline">登录</NuxtLink> 后可将导航配置同步到云端，并展示你的云端网址。
    </p>
  </div>
</template>
