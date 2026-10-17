<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl

const category = computed(() => String(route.query.category || ''))
const q = computed(() => String(route.query.q || ''))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const keyword = ref(q.value)

const { data, pending } = await useAsyncData(
  'directory-list',
  () => $fetch('/api/directory', { query: { category: category.value, q: q.value, page: page.value, size: 24 } }),
  { watch: [category, q, page] }
)

watch(q, (v) => { keyword.value = v })

const items = computed<any[]>(() => (data.value as any)?.items || [])
const categories = computed<any[]>(() => (data.value as any)?.categories || [])
const total = computed(() => Number((data.value as any)?.total || 0))
const all = computed(() => Number((data.value as any)?.all || 0))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / 24)))

const seoTitle = computed(() => {
  const c = category.value
  return c ? `${c}网站目录 · 精选站点导航 | 2077` : '分类目录 · 精选网站导航 | 2077'
})
const seoDesc = computed(() => {
  const c = category.value
  return c
    ? `浏览 2077 导航「${c}」分类下的精选网站，查看站点简介、官网入口与同类推荐。`
    : `2077 导航分类目录，按分类浏览精选网站，提供站点简介、官网入口与同类站点推荐，共 ${all.value} 个站点。`
})

useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogType: 'website',
  ogUrl: () => siteUrl + '/site' + (category.value ? `?category=${encodeURIComponent(category.value)}` : ''),
  robots: () => (q.value ? 'noindex,follow' : 'index,follow')
})

useHead(() => ({
  link: [{ rel: 'canonical', href: siteUrl + '/site' + (category.value ? `?category=${encodeURIComponent(category.value)}` : '') }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seoTitle.value,
      description: seoDesc.value,
      url: siteUrl + '/site',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: items.value.map((it: any, i: number) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteUrl}/site/${it.id}.html`,
          name: it.name
        }))
      }
    })
  }]
}))

function go(patch: Record<string, any>) {
  const query: Record<string, any> = { ...route.query, ...patch }
  for (const k of Object.keys(query)) {
    if (query[k] === '' || query[k] === null || query[k] === undefined || (k === 'page' && Number(query[k]) <= 1)) delete query[k]
  }
  router.push({ path: '/site', query })
}

function search() {
  go({ q: keyword.value.trim(), page: 1 })
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-8 sm:py-10">
    <header class="mb-6">
      <p class="text-[12px] text-ink3 mb-1">2077 导航 · 分类目录</p>
      <h1 class="text-[26px] sm:text-[32px] font-extrabold tracking-tight">精选网站目录</h1>
      <p class="text-ink2 text-[13px] mt-2 max-w-[720px] leading-relaxed">
        按分类浏览已收录的网站，每个站点拥有独立介绍页，方便检索、分享与被搜索引擎收录。
      </p>
      <p class="text-[12px] text-ink3 mt-2">共 {{ all }} 个站点 · 当前筛选 {{ total }} 个</p>
    </header>

    <div class="flex flex-col gap-3 mb-5">
      <form class="flex gap-2" @submit.prevent="search">
        <input v-model="keyword" class="field grow" placeholder="搜索站点名称、简介或网址" />
        <button class="btn shrink-0" type="submit">搜索</button>
        <button v-if="q" type="button" class="btn btn-ghost shrink-0" @click="keyword = ''; go({ q: '', page: 1 })">清除</button>
      </form>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-sm" :class="!category ? 'btn-primary' : 'btn-ghost'" @click="go({ category: '', page: 1 })">全部</button>
        <button
          v-for="c in categories"
          :key="c.category"
          class="btn btn-sm"
          :class="category === c.category ? 'btn-primary' : 'btn-ghost'"
          @click="go({ category: c.category, page: 1 })"
        >{{ c.category }} <span class="opacity-60">{{ c.n }}</span></button>
      </div>
    </div>

    <div v-if="pending" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div v-for="i in 6" :key="i" class="card p-4 h-[132px] animate-pulse" />
    </div>
    <div v-else-if="!items.length" class="card p-10 text-center text-ink2 text-[13px]">
      没有找到符合条件的站点。
      <button class="btn btn-sm btn-ghost ml-2" @click="go({ category: '', q: '', page: 1 })">查看全部</button>
    </div>
    <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <article v-for="it in items" :key="it.id" class="card p-4 flex flex-col gap-2.5 hover:border-ink/30 transition-colors">
        <div class="flex items-start gap-3">
          <img :src="it.icon || `/api/icon?url=${encodeURIComponent(new URL(it.url).hostname)}`" alt="" class="w-9 h-9 rounded-xl shrink-0" loading="lazy" referrerpolicy="no-referrer" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <h2 class="font-semibold text-[14.5px] truncate">{{ it.name }}</h2>
              <span v-if="it.featured" class="chip !text-[10px]">精选</span>
            </div>
            <span class="text-[11.5px] text-ink3">{{ it.category }}</span>
          </div>
        </div>
        <p class="text-[12.5px] text-ink2 leading-relaxed line-clamp-2 min-h-[36px]">{{ it.description || '收录于 2077 导航分类目录。' }}</p>
        <div class="flex items-center gap-2 mt-auto">
          <NuxtLink :to="`/site/${it.id}.html`" class="btn btn-sm btn-primary flex-1 justify-center">查看详情</NuxtLink>
          <a :href="it.url" target="_blank" rel="nofollow noopener" class="btn btn-sm btn-ghost">官网</a>
        </div>
      </article>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-6 flex-wrap">
      <button class="btn btn-sm" :disabled="page <= 1" @click="go({ page: page - 1 })">上一页</button>
      <span class="text-[12.5px] text-ink2">{{ page }} / {{ totalPages }}</span>
      <button class="btn btn-sm" :disabled="page >= totalPages" @click="go({ page: page + 1 })">下一页</button>
    </div>
  </div>
</template>
