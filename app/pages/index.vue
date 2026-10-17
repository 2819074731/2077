<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { DEFAULT_GROUPS, INLINE_GROUP_COUNT } from '~/data/nav'

const { groups, diy, syncMsg, loadLocal, applySite, addGroup, resetAll, activeCat, visibleGroups } = useNav()
const { categories, loadCategories } = useCategories()
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
await loadCategories()

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
const shownGroups = computed(() => {
  const list = visibleGroups()
  if (activeCat.value) return list
  const university = groups.value.find((g) => g.name === '高校')
  return university && !list.some((g) => g.name === '高校') ? [...list, university] : list
})
const menuCount = computed(() => {
  const seen = new Set(groups.value.map((g) => g.name))
  return groups.value.length + categories.value.filter((name) => !seen.has(name)).length
})
const hasMoreGroups = computed(() => menuCount.value > INLINE_GROUP_COUNT && !activeCat.value)
const activeCategoryName = computed(() => {
  if (!activeCat.value) return ''
  const g = groups.value.find((x) => x.id === activeCat.value || x.name === activeCat.value)
  return g?.name || String(activeCat.value)
})
const activeEmpty = computed(() => !!activeCat.value && !shownGroups.value.some((g) => g.links.length > 0))
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
        <span>{{ menuCount }} 个分类</span>
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
        <div v-if="activeEmpty" class="card p-6 sm:p-8 text-center mb-8">
          <p class="text-[15px] font-semibold">{{ activeCategoryName }}</p>
          <p class="mt-1 text-[12.5px] text-ink2">该分类暂无首页导航站点，可在分类目录中浏览收录内容。</p>
          <NuxtLink :to="`/site?category=${encodeURIComponent(activeCategoryName)}`" class="btn btn-sm btn-primary mt-4">查看分类目录</NuxtLink>
        </div>
        <template v-else>
          <LinkGroup v-for="g in shownGroups" :key="g.id" :group="g" />
        </template>
      </div>
      <template #fallback>
        <div>
          <LinkGroup v-for="g in DEFAULT_GROUPS.slice(0, INLINE_GROUP_COUNT)" :key="g.id" :group="g" />
        </div>
      </template>
    </ClientOnly>

    <div v-if="hasMoreGroups" class="text-center mb-8">
      <button v-if="isMobile" class="btn btn-sm" @click="openDrawer">查看全部 {{ menuCount }} 个分类</button>
      <span v-else class="text-[12.5px] text-ink2">
        更多分类（{{ menuCount - INLINE_GROUP_COUNT }} 个）已收起，点击上方分类或右上角「自定义」可编辑。
      </span>
    </div>

    <p v-if="user" class="text-[12px] text-ink2 mb-10 text-center">
      已登录 {{ user.nickname }}，配置已开启云端同步。
    </p>
    <p v-else class="text-[12px] text-ink2 mb-10 text-center">
      <NuxtLink to="/login" class="text-ink hover:underline">登录</NuxtLink> 后可将导航配置同步到云端，并展示你的云端网址。
    </p>

    <QuickImport v-model="importOpen" />
  </div>
</template>
