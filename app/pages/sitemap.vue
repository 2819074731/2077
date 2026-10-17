<script setup lang="ts">
import { computed } from 'vue'

const siteUrl = useRuntimeConfig().public.siteUrl

const [{ data: dir }, { data: nav }] = await Promise.all([
  useFetch('/api/directory/all', { key: 'sitemap-directory' }),
  useFetch('/api/site', { key: 'sitemap-nav' })
])

const items = computed<any[]>(() => (dir.value as any)?.items || [])
const categories = computed<any[]>(() => (dir.value as any)?.categories || [])
const groups = computed<any[]>(() => (nav.value as any)?.groups || [])

const grouped = computed(() => {
  const map = new Map<string, any[]>()
  for (const it of items.value) {
    const key = String(it.category || '其他')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  return Array.from(map.entries()).map(([category, list]) => ({ category, items: list }))
})

function iconOf(url: string) {
  try { return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}` } catch { return '' }
}

const title = '站点地图 · 2077 导航'
const description = `2077 导航的完整站点地图：首页导航分类、分类目录站点与主要页面入口，共 ${items.value.length} 个目录站点。`

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: 'website',
  ogUrl: siteUrl + '/sitemap',
  robots: 'index,follow'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: siteUrl + '/sitemap' }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': siteUrl + '/sitemap#webpage',
          url: siteUrl + '/sitemap',
          name: title,
          description,
          inLanguage: 'zh-CN',
          isPartOf: { '@id': siteUrl + '/#website' },
          publisher: { '@id': siteUrl + '/#organization' },
          breadcrumb: { '@id': siteUrl + '/sitemap#breadcrumb' }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': siteUrl + '/sitemap#breadcrumb',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl + '/' },
            { '@type': 'ListItem', position: 2, name: '站点地图', item: siteUrl + '/sitemap' }
          ]
        }
      ]
    })
  }]
}))
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-8 sm:py-10">
    <nav class="flex items-center gap-1.5 text-[12px] text-ink3 mb-5">
      <NuxtLink to="/" class="hover:text-ink">首页</NuxtLink>
      <span>/</span>
      <span class="text-ink2">站点地图</span>
    </nav>

    <header class="mb-7">
      <h1 class="text-[26px] sm:text-[32px] font-extrabold tracking-tight">站点地图</h1>
      <p class="text-ink2 text-[13px] mt-2 max-w-[760px] leading-relaxed">
        这里汇总了 2077 导航的主要页面、首页导航分类与分类目录下的全部站点，方便访客与搜索引擎快速遍历全站内容。
      </p>
      <p class="text-[12px] text-ink3 mt-2">目录站点 {{ items.length }} 个 · {{ categories.length }} 个分类 · 首页导航 {{ groups.length }} 个分组</p>
    </header>

    <section class="card p-5 sm:p-6 mb-5">
      <h2 class="text-[16px] font-semibold mb-3">主要页面</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/" class="btn btn-sm">首页导航</NuxtLink>
        <NuxtLink to="/site" class="btn btn-sm">分类目录</NuxtLink>
        <NuxtLink to="/submit" class="btn btn-sm">提交收录</NuxtLink>
        <NuxtLink to="/sitemap" class="btn btn-sm btn-ghost">站点地图</NuxtLink>
        <a href="/sitemap.xml" class="btn btn-sm btn-ghost">XML Sitemap</a>
      </div>
    </section>

    <section v-if="groups.length" class="card p-5 sm:p-6 mb-5">
      <h2 class="text-[16px] font-semibold mb-3">首页导航分类</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink v-for="g in groups" :key="g.name" to="/" class="chip hover:text-ink">{{ g.name }} {{ g.links?.length || 0 }}</NuxtLink>
      </div>
      <p class="text-[12px] text-ink3 mt-3">首页导航展示精选站点，审核标准较高。</p>
    </section>

    <section v-for="g in grouped" :key="g.category" class="card p-5 sm:p-6 mb-5">
      <div class="flex items-center gap-2.5 mb-4 flex-wrap">
        <h2 class="text-[16px] font-semibold">{{ g.category }}</h2>
        <span class="chip">{{ g.items.length }}</span>
        <div class="flex-1" />
        <NuxtLink :to="`/site?category=${encodeURIComponent(g.category)}`" class="text-[12.5px] text-ink2 hover:text-ink">查看分类</NuxtLink>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <template v-for="it in g.items" :key="it.id">
          <NuxtLink
            v-if="it.detail_enabled"
            :to="`/site/${it.id}.html`"
            class="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 hover:border-ink/30 transition-colors"
          >
            <SiteIcon :src="iconOf(it.url)" :name="it.name" :url="it.url" class="w-7 h-7 rounded-lg shrink-0 text-[11px]" />
            <span class="min-w-0">
              <span class="block text-[13px] font-medium truncate">{{ it.name }}</span>
              <span class="block text-[11px] text-ink3 truncate">详情页</span>
            </span>
          </NuxtLink>
          <a
            v-else
            :href="it.url"
            target="_blank"
            rel="nofollow noopener"
            class="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 hover:border-ink/30 transition-colors"
          >
            <SiteIcon :src="iconOf(it.url)" :name="it.name" :url="it.url" class="w-7 h-7 rounded-lg shrink-0 text-[11px]" />
            <span class="min-w-0">
              <span class="block text-[13px] font-medium truncate">{{ it.name }}</span>
              <span class="block text-[11px] text-ink3 truncate">官网直达</span>
            </span>
          </a>
        </template>
      </div>
    </section>

    <div v-if="!items.length" class="card p-8 text-center text-ink2 text-[13px] mb-5">
      分类目录暂时还没有站点。<NuxtLink to="/submit" class="text-ink hover:underline">提交第一个站点</NuxtLink>
    </div>

    <section class="card p-5 sm:p-6 text-[12.5px] text-ink2 leading-relaxed">
      <h2 class="text-[16px] font-semibold text-ink mb-2">关于收录</h2>
      2077 导航提供首页导航与分类目录两种收录方式。首页导航审核标准较高，分类目录按主题长期收录站点。
    </section>
  </div>
</template>
