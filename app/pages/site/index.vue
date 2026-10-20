<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { categoryIntro } from '#shared/categoryIntro'
import { useNav } from '~/composables/useNav'

const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl

const { settings, loadSiteSettings } = useSiteSettings()
await loadSiteSettings()
const PAGE_SIZE = settings.value.directoryPageSize
const category = computed(() => String(route.query.category || ''))
const q = computed(() => String(route.query.q || ''))
const province = computed(() => String(route.query.province || ''))
const sort = computed(() => {
  const value = String(route.query.sort || '')
  return ['latest', 'name'].includes(value) ? value : 'recommended'
})
const level = computed(() => String(route.query.level || ''))
const type = computed(() => String(route.query.type || ''))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const keyword = ref(q.value)

const { recordClick, isBookmarked, toggleBookmark } = useNav()

const { data, pending } = await useAsyncData(
  'directory-list',
  () => ($fetch as unknown as (input: string, opts?: Record<string, unknown>) => Promise<unknown>)('/api/directory', { query: { category: category.value, q: q.value, province: province.value, level: level.value, type: type.value, sort: sort.value, page: page.value, size: PAGE_SIZE } }),
  { watch: [category, q, province, level, type, sort, page] }
)

const { data: popularData, pending: popularPending } = await useAsyncData(
  'directory-popular',
  () => ($fetch as unknown as (input: string, opts?: Record<string, unknown>) => Promise<unknown>)('/api/directory/popular', { query: { days: 7, limit: category.value ? 4 : 8, category: category.value } }),
  { watch: [category] }
)

watch(q, (v) => { keyword.value = v })

const items = computed<any[]>(() => (data.value as any)?.items || [])
const categories = computed<any[]>(() => (data.value as any)?.categories || [])
const provinces = computed<any[]>(() => (data.value as any)?.provinces || [])
const levels = computed<any[]>(() => (data.value as any)?.levels || [])
const types = computed<any[]>(() => (data.value as any)?.types || [])
const total = computed(() => Number((data.value as any)?.total || 0))
const all = computed(() => Number((data.value as any)?.all || 0))
const popular = computed<any[]>(() => (popularData.value as any)?.items || [])
const showPopular = computed(() => !popularPending.value && !q.value && popular.value.length >= (category.value ? 2 : 3))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageNumbers = computed<(number | string)[]>(() => {
  const totalCount = totalPages.value
  const current = page.value
  const picked = new Set<number>([1, totalCount])
  for (let n = Math.max(1, current - 2); n <= Math.min(totalCount, current + 2); n++) picked.add(n)
  const sorted = [...picked].sort((a, b) => a - b)
  const out: (number | string)[] = []
  let last = 0
  for (const n of sorted) {
    if (last && n - last > 1) out.push('...')
    out.push(n)
    last = n
  }
  return out
})
function provinceLabel(p: string) {
  return p.replace(/(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)$/, '')
}
function provinceHref(p: string) {
  const qs = new URLSearchParams({ category: '高校' })
  if (p) qs.set('province', p)
  if (sort.value !== 'recommended') qs.set('sort', sort.value)
  return '/site?' + qs.toString()
}
function pageHref(n: number) {
  const qs = new URLSearchParams()
  if (category.value) qs.set('category', category.value)
  if (province.value) qs.set('province', province.value)
  if (level.value) qs.set('level', level.value)
  if (type.value) qs.set('type', type.value)
  if (sort.value !== 'recommended') qs.set('sort', sort.value)
  if (q.value) qs.set('q', q.value)
  if (n > 1) qs.set('page', String(n))
  const s = qs.toString()
  return '/site' + (s ? '?' + s : '')
}
const canonicalUrl = computed(() => {
  const qs = new URLSearchParams()
  if (category.value) qs.set('category', category.value)
  if (province.value) qs.set('province', province.value)
  if (level.value) qs.set('level', level.value)
  if (type.value) qs.set('type', type.value)
  if (sort.value !== 'recommended') qs.set('sort', sort.value)
  if (page.value > 1) qs.set('page', String(page.value))
  const s = qs.toString()
  return siteUrl + '/site' + (s ? '?' + s : '')
})

const seoTitle = computed(() => {
  const c = category.value
  if (province.value) return `${provinceLabel(province.value)}高校名单 · 院校网址导航 | ${settings.value.siteName}`
  return c ? `${c}网站目录 · ${settings.value.siteName}` : `网站目录 · 精选站点收录 | ${settings.value.siteName}`
})
const intro = computed(() => {
  if (province.value) return `汇总${provinceLabel(province.value)}的普通高校、职业院校与成人高校官网入口，按办学层次与类型整理，方便查询与访问。`
  return category.value ? categoryIntro(category.value, settings.value.siteName) : ''
})
const seoDesc = computed(() => {
  const c = category.value
  const extra = [level.value, type.value].filter(Boolean).join('、')
  if (province.value) return `${provinceLabel(province.value)}高校名单与官网入口，当前收录 ${total.value} 所院校${extra ? `，已筛选${extra}` : '，可按办学层次与类型筛选'}。`
  return c
    ? `${categoryIntro(c, settings.value.siteName)} 当前收录 ${total.value} 个站点${extra ? `（${extra}）` : ''}。`
    : `${settings.value.siteName}网站目录，按分类浏览已收录网站，提供站点简介、官网入口与分类筛选，共 ${all.value} 个站点。`
})

useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogType: 'website',
  ogUrl: canonicalUrl,
  robots: () => (q.value || page.value > 1 || level.value || type.value || sort.value !== 'recommended' ? 'noindex,follow' : 'index,follow')
})

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
  script: [{
    type: 'application/ld+json',
    innerHTML: jsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': canonicalUrl.value + '#webpage',
          name: seoTitle.value,
          description: seoDesc.value,
          url: canonicalUrl.value,
          inLanguage: 'zh-CN',
          isPartOf: { '@id': siteUrl + '/#website' },
          publisher: { '@id': siteUrl + '/#organization' },
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: items.value.map((it: any, i: number) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${siteUrl}/site/${it.id}.html`,
              name: it.name
            }))
          },
          breadcrumb: { '@id': siteUrl + '/site#breadcrumb' }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': siteUrl + '/site#breadcrumb',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl + '/' },
            { '@type': 'ListItem', position: 2, name: '网站目录', item: siteUrl + '/site' },
            ...(category.value ? [{ '@type': 'ListItem', position: 3, name: category.value, item: siteUrl + '/site?category=' + encodeURIComponent(category.value) }] : []),
            ...(province.value ? [{ '@type': 'ListItem', position: category.value ? 4 : 3, name: provinceLabel(province.value), item: canonicalUrl.value }] : [])
          ]
        }
      ]
    })
  }]
}))

function iconOf(url: string) {
  try { return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}` } catch { return '' }
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./i, '') } catch { return url }
}

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

function resetAll() {
  keyword.value = ''
  go({ category: '', province: '', level: '', type: '', sort: '', q: '', page: 1 })
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-5 sm:py-8">
    <header class="flex items-start justify-between gap-3 mb-4">
      <div class="min-w-0">
        <h1 class="text-[24px] sm:text-[28px] font-extrabold tracking-tight leading-tight">{{ province ? provinceLabel(province) + '高校' : (category ? category : '网站目录') }}</h1>
        <p class="text-[12px] text-ink3 mt-1">
          共 {{ total }} 个站点<span v-if="categories.length"> · {{ categories.length }} 个分类</span>
        </p>
      </div>
      <NuxtLink to="/submit" class="btn btn-sm shrink-0">提交网站</NuxtLink>
    </header>

    <div class="flex flex-col gap-2.5 mb-3">
      <form class="flex gap-2" @submit.prevent="search">
        <div class="relative grow min-w-0">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input v-model="keyword" class="field pl-9" placeholder="搜索网站名称、网址或简介" />
        </div>
        <button class="btn shrink-0 px-4" type="submit">搜索</button>
        <button v-if="q" type="button" class="btn btn-ghost shrink-0" @click="resetAll">清除</button>
      </form>

      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
        <button
          class="shrink-0 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors"
          :class="!category ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="go({ category: '', province: '', level: '', type: '', page: 1 })"
        >全部 <span class="opacity-60">{{ all }}</span></button>
        <button
          v-for="c in categories"
          :key="c.category"
          class="shrink-0 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors"
          :class="category === c.category ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="go({ category: c.category, province: '', level: '', type: '', page: 1 })"
        >{{ c.category }} <span class="opacity-60">{{ c.n }}</span></button>
      </div>

      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
        <span class="shrink-0 text-[11.5px] text-ink3">排序</span>
        <button
          v-for="opt in [{ v: 'recommended', l: '推荐' }, { v: 'latest', l: '最新' }, { v: 'name', l: '名称' }]"
          :key="opt.v"
          class="shrink-0 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors"
          :class="sort === opt.v ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="go({ sort: opt.v === 'recommended' ? '' : opt.v, page: 1 })"
        >{{ opt.l }}</button>
      </div>

      <div v-if="category === '高校' && levels.length" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
        <span class="shrink-0 text-[11.5px] text-ink3">层次</span>
        <button
          class="shrink-0 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors"
          :class="!level ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="go({ level: '', page: 1 })"
        >全部</button>
        <button
          v-for="item in levels"
          :key="item.value"
          class="shrink-0 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors"
          :class="level === item.value ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="go({ level: level === item.value ? '' : item.value, page: 1 })"
        >{{ item.value }} <span class="opacity-60">{{ item.n }}</span></button>
      </div>

      <div v-if="category === '高校' && types.length" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
        <span class="shrink-0 text-[11.5px] text-ink3">类型</span>
        <button
          class="shrink-0 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors"
          :class="!type ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="go({ type: '', page: 1 })"
        >全部</button>
        <button
          v-for="item in types"
          :key="item.value"
          class="shrink-0 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors"
          :class="type === item.value ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="go({ type: type === item.value ? '' : item.value, page: 1 })"
        >{{ item.value }} <span class="opacity-60">{{ item.n }}</span></button>
      </div>

      <div v-if="category === '高校' && provinces.length" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
        <NuxtLink
          to="/site?category=%E9%AB%98%E6%A0%A1"
          class="shrink-0 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors"
          :class="!province ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
        >全部地区</NuxtLink>
        <NuxtLink
          v-for="p in provinces"
          :key="p.province"
          :to="provinceHref(p.province)"
          class="shrink-0 h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors"
          :class="province === p.province ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
        >{{ provinceLabel(p.province) }} <span class="opacity-60">{{ p.n }}</span></NuxtLink>
      </div>
    </div>

    <p v-if="intro" class="text-[12.5px] sm:text-[13px] leading-6 text-ink2 mb-2.5">{{ intro }}</p>

    <section v-if="showPopular" class="mb-5">
      <div class="flex items-center gap-2 mb-2.5">
        <h2 class="text-[14px] font-semibold tracking-tight">{{ category ? '本类热门' : '本周热门' }}</h2>
        <span class="chip !text-[10px]">近 7 天点击</span>
      </div>
      <div class="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 snap-x">
        <a
          v-for="(it, index) in popular"
          :key="it.id"
          :href="it.url"
          target="_blank"
          rel="nofollow noopener"
          class="card group flex w-[216px] sm:w-[236px] shrink-0 snap-start items-center gap-2.5 p-3 transition-colors hover:border-ink/25"
          @click="recordClick(it.url, it.name)"
        >
          <span class="grid place-items-center w-6 h-6 rounded-lg text-[11px] font-semibold shrink-0" :class="index < 3 ? 'bg-ink text-bg' : 'bg-card2 text-ink3'">{{ index + 1 }}</span>
          <SiteIcon :src="it.icon || iconOf(it.url)" :name="it.name" :url="it.url" class="w-9 h-9 rounded-xl shrink-0 text-[12px]" />
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-medium truncate group-hover:text-accent transition-colors">{{ it.name }}</span>
            <span class="block text-[11px] text-ink3 truncate mt-0.5">{{ it.category }} · 近 7 天 {{ it.hits }} 次</span>
          </span>
        </a>
      </div>
    </section>

    <div class="flex items-center gap-2 mb-2.5 min-h-[24px]">
      <span class="text-[12px] text-ink3">{{ category || (q ? `搜索「${q}」` : '全部站点') }} · {{ total }} 个</span>
      <div class="flex-1" />
      <button v-if="category || q || level || type || sort !== 'recommended'" class="text-[12px] text-ink2 hover:text-ink" @click="resetAll">清除筛选</button>
    </div>

    <div v-if="pending" class="flex flex-col gap-2">
      <div v-for="i in 5" :key="i" class="card h-[112px] animate-pulse" />
    </div>
    <div v-else-if="!items.length" class="card p-10 text-center text-ink2 text-[13px]">
      没有找到符合条件的站点。
      <button class="btn btn-sm btn-ghost ml-2" @click="resetAll">查看全部</button>
    </div>
    <div v-else class="flex flex-col gap-2">
      <article
        v-for="it in items"
        :key="it.id"
        class="card group p-4 sm:px-5 sm:py-4 transition-all duration-200 hover:border-ink/25"
      >
        <div class="flex items-start gap-3.5">
          <SiteIcon :src="it.icon || iconOf(it.url)" :name="it.name" :url="it.url" class="w-11 h-11 rounded-2xl shrink-0 text-[14px]" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-x-2 gap-y-1 flex-wrap">
              <h2 class="font-semibold text-[15px] sm:text-[16px] leading-6">{{ it.name }}</h2>
              <span v-if="it.featured" class="chip !text-[10px]">精选</span>
              <span class="chip !text-[10px]">{{ it.category }}</span>
              <button
                class="grid place-items-center w-6 h-6 rounded-md transition-colors"
                :class="isBookmarked(it.url) ? 'text-accent bg-accentsoft' : 'text-ink3 hover:text-ink hover:bg-card2'"
                :title="isBookmarked(it.url) ? '取消收藏' : '收藏'"
                :aria-label="isBookmarked(it.url) ? '取消收藏' : '收藏'"
                @click.prevent.stop="toggleBookmark({ url: it.url, name: it.name, icon: it.icon })"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" :fill="isBookmarked(it.url) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>
              </button>
            </div>
            <p class="text-[12.5px] sm:text-[13px] text-ink2 leading-relaxed line-clamp-2 mt-1">
              {{ it.description || `收录于${settings.siteName}「${it.category}」分类。` }}
            </p>
            <div class="flex items-center gap-1.5 mt-1.5 text-[11.5px] text-ink3 min-w-0">
              <span class="truncate">{{ hostOf(it.url) }}</span>
              <template v-if="it.detail_enabled">
                <span class="opacity-40">·</span>
                <span class="shrink-0">详情页</span>
              </template>
            </div>
          </div>
          <div class="hidden sm:flex items-center gap-2 shrink-0 self-center">
            <template v-if="it.detail_enabled">
              <NuxtLink :to="`/site/${it.id}.html`" class="btn btn-sm btn-primary">查看详情</NuxtLink>
              <a :href="it.url" target="_blank" rel="nofollow noopener" class="btn btn-sm btn-ghost" @click="recordClick(it.url, it.name)">官网</a>
            </template>
            <a v-else :href="it.url" target="_blank" rel="nofollow noopener" class="btn btn-sm btn-primary" @click="recordClick(it.url, it.name)">访问网站</a>
          </div>
        </div>

        <div class="flex gap-2 mt-3 sm:hidden">
          <template v-if="it.detail_enabled">
            <NuxtLink :to="`/site/${it.id}.html`" class="btn btn-sm btn-primary flex-1 justify-center">查看详情</NuxtLink>
            <a :href="it.url" target="_blank" rel="nofollow noopener" class="btn btn-sm flex-1 justify-center" @click="recordClick(it.url, it.name)">访问官网</a>
          </template>
          <a v-else :href="it.url" target="_blank" rel="nofollow noopener" class="btn btn-sm btn-primary flex-1 justify-center" @click="recordClick(it.url, it.name)">访问网站</a>
        </div>
      </article>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-6 flex-wrap">
      <NuxtLink v-if="page > 1" :to="pageHref(page - 1)" class="btn btn-sm">上一页</NuxtLink>
      <span v-else class="btn btn-sm opacity-45 cursor-not-allowed">上一页</span>
      <template v-for="(n, i) in pageNumbers" :key="`${n}-${i}`">
        <span v-if="n === '...'" class="text-[12px] text-ink3 px-1">…</span>
        <span v-else-if="n === page" class="btn btn-sm btn-primary min-w-9 justify-center">{{ n }}</span>
        <NuxtLink v-else :to="pageHref(Number(n))" class="btn btn-sm min-w-9 justify-center">{{ n }}</NuxtLink>
      </template>
      <NuxtLink v-if="page < totalPages" :to="pageHref(page + 1)" class="btn btn-sm">下一页</NuxtLink>
      <span v-else class="btn btn-sm opacity-45 cursor-not-allowed">下一页</span>
    </div>

    <div class="mt-8 pt-5 border-t border-line flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink2">
      <span>没找到想要的站点？</span>
      <NuxtLink to="/submit" class="text-ink hover:underline">提交收录</NuxtLink>
      <span class="opacity-40">·</span>
      <NuxtLink to="/sitemap" class="hover:text-ink">站点地图</NuxtLink>
    </div>
  </div>
</template>
