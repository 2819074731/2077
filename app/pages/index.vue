<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { DEFAULT_GROUPS, INLINE_GROUP_COUNT } from '~/data/nav'

const { groups, diy, syncMsg, loadLocal, applySite, addGroup, resetAll, activeCat, visibleGroups } = useNav()
const { user, refresh } = useAuth()
const { isMobile } = useDevice()

onMounted(async () => {
  loadLocal()
  await refresh()
  loadLocal()
})

const siteUrl = useRuntimeConfig().public.siteUrl

const { data: siteData } = await useFetch('/api/site', { key: 'site-config' })
applySite(siteData.value, { groups: true })

const { data: dirData } = await useFetch('/api/directory', { query: { size: 6 }, key: 'home-directory' })
const directoryItems = computed<any[]>(() => (dirData.value as any)?.items || [])
const directoryTotal = computed(() => Number((dirData.value as any)?.all || 0))

function iconOf(url: string) {
  try { return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}` } catch { return '' }
}

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
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': siteUrl + '/#website',
          name: '2077 导航',
          alternateName: 'my2077',
          url: siteUrl + '/',
          inLanguage: 'zh-CN',
          description: '可自定义的浏览器起始页，聚合常用站点，并提供独立的分类网站目录。',
          publisher: { '@id': siteUrl + '/#organization' },
          potentialAction: {
            '@type': 'SearchAction',
            target: siteUrl + '/?q={search_term_string}',
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@type': 'Organization',
          '@id': siteUrl + '/#organization',
          name: '2077 导航',
          url: siteUrl + '/',
          description: '2077 导航是中文网址导航与网站目录，提供首页导航与分类目录两种收录方式。'
        }
      ]
    })
  }]
})

const totalLinks = computed(() => groups.value.reduce((n, g) => n + g.links.length, 0))
const shownGroups = computed(() => visibleGroups())
const hasMoreGroups = computed(() => groups.value.length > INLINE_GROUP_COUNT && !activeCat.value)
const drawerOpen = useState<boolean>('nav-drawer-open', () => false)
const importOpen = ref(false)
function openDrawer() { drawerOpen.value = true }
</script>

<template>
  <div class="max-w-wrap mx-auto px-4">
    <section class="pb-8 flex flex-col items-center text-center gap-4" :class="isMobile ? 'pt-12' : 'pt-16'">
      <h1 class="font-extrabold tracking-tight leading-[1.1]" :class="isMobile ? 'text-[30px]' : 'text-[40px]'">
        2077 导航
      </h1>
      <div class="w-full max-w-[680px]">
        <SearchBar />
      </div>
      <div class="flex items-center gap-3 text-[12px] text-ink2 flex-wrap justify-center">
        <span>{{ groups.length }} 个分类</span>
        <span class="opacity-40">·</span>
        <span>{{ totalLinks }} 个站点</span>
      </div>
    </section>

    <div v-if="diy" class="card px-4 py-3 mb-7 flex items-center gap-3 text-[13px] animate-fade-up flex-wrap">
      <span class="grid place-items-center w-6 h-6 rounded-lg bg-card2 text-ink shrink-0">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      </span>
      <span class="text-ink2">编辑模式：修改名称、增删链接与分组，登录后自动同步到云端。</span>
      <div class="flex-1" />
      <span v-if="syncMsg" class="text-ink2" :class="isMobile && 'hidden'">{{ syncMsg }}</span>
      <button class="btn btn-sm" @click="importOpen = true">批量导入</button>
      <button class="btn btn-sm" @click="addGroup">+ 分组</button>
      <button class="btn btn-sm" @click="resetAll">恢复默认</button>
    </div>

    <ClientOnly>
      <FrequentLinks />
    </ClientOnly>

    <CategoryBar />

    <ClientOnly>
      <div class="animate-fade-up">
        <LinkGroup v-for="g in shownGroups" :key="g.id" :group="g" />
      </div>
      <template #fallback>
        <div>
          <LinkGroup v-for="g in DEFAULT_GROUPS.slice(0, INLINE_GROUP_COUNT)" :key="g.id" :group="g" />
        </div>
      </template>
    </ClientOnly>

    <div v-if="hasMoreGroups" class="text-center mb-8">
      <button v-if="isMobile" class="btn btn-sm" @click="openDrawer">查看全部 {{ groups.length }} 个分类</button>
      <span v-else class="text-[12.5px] text-ink2">
        更多分类（{{ groups.length - INLINE_GROUP_COUNT }} 个）已收起，点击上方分类或右上角「自定义」可编辑。
      </span>
    </div>

    <section v-if="directoryItems.length" class="mb-10 animate-fade-up">
      <div class="flex items-center gap-2.5 mb-3.5">
        <span class="h-4 w-1 rounded-full accent-bar" />
        <h2 class="text-[15px] font-semibold tracking-tight">精选网站目录</h2>
        <span class="chip">{{ directoryTotal }}</span>
        <div class="flex-1" />
        <NuxtLink to="/site" class="btn btn-sm btn-ghost">查看全部站点</NuxtLink>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <component
          :is="it.detail_enabled ? 'NuxtLink' : 'a'"
          v-for="it in directoryItems"
          :key="it.id"
          v-bind="it.detail_enabled ? { to: `/site/${it.id}.html` } : { href: it.url, target: '_blank', rel: 'nofollow noopener' }"
          class="card p-4 flex items-start gap-3 hover:border-ink/30 transition-colors"
        >
          <SiteIcon :src="it.icon || iconOf(it.url)" :name="it.name" :url="it.url" class="w-9 h-9 rounded-xl shrink-0 text-[13px]" />
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1.5">
              <span class="font-semibold text-[14px] truncate">{{ it.name }}</span>
              <span v-if="it.featured" class="chip !text-[10px]">精选</span>
            </span>
            <span class="block text-[11.5px] text-ink3 mt-0.5">{{ it.category }}</span>
            <span class="block text-[12px] text-ink2 leading-relaxed line-clamp-2 mt-1.5">{{ it.description || `收录于 2077 导航「${it.category}」分类。` }}</span>
          </span>
        </component>
      </div>
    </section>

    <p v-if="user" class="text-[12px] text-ink2 mb-10 text-center">
      已登录 {{ user.nickname }}，配置已开启云端同步。
    </p>
    <p v-else class="text-[12px] text-ink2 mb-10 text-center">
      <NuxtLink to="/login" class="text-ink hover:underline">登录</NuxtLink> 后可将导航配置同步到云端，并展示你的云端网址。
    </p>

    <QuickImport v-model="importOpen" />
  </div>
</template>
