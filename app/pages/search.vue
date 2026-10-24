<script setup lang="ts">
import { computed } from 'vue'
import {
  isValidSearchSort,
  isValidSearchType,
  SEARCH_PAGE_SIZE,
  SEARCH_SORT_OPTIONS,
  SEARCH_TYPE_OPTIONS
} from '#shared/search'

const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl
const { settings, loadSiteSettings } = useSiteSettings()
await loadSiteSettings()

const q = computed(() => String(route.query.q || '').trim())
const type = computed(() => {
  const value = String(route.query.type || '')
  return isValidSearchType(value) ? value : 'all'
})
const category = computed(() => String(route.query.category || '').trim())
const sort = computed(() => {
  const value = String(route.query.sort || '')
  return isValidSearchSort(value) ? value : 'relevance'
})
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

const { data, pending, error, refresh } = await useAsyncData(
  'site-search',
  () => ($fetch as unknown as (input: string, opts?: Record<string, unknown>) => Promise<unknown>)('/api/search', {
    query: {
      q: q.value,
      type: type.value,
      category: category.value,
      sort: sort.value,
      page: page.value,
      size: SEARCH_PAGE_SIZE
    }
  }),
  { watch: [q, type, category, sort, page] }
)

const result = computed<any>(() => data.value || {})
const items = computed<any[]>(() => result.value.items || [])
const total = computed(() => Number(result.value.total || 0))
const counts = computed(() => result.value.counts || { all: 0, directory: 0, link: 0 })
const categories = computed<any[]>(() => result.value.categories || [])
const hot = computed<string[]>(() => result.value.hot || [])
const took = computed(() => Number(result.value.took || 0))
const incomplete = computed(() => !!result.value.incomplete)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / SEARCH_PAGE_SIZE)))
const errorMessage = computed(() => {
  if (!error.value) return ''
  const e: any = error.value
  return e?.data?.statusMessage || e?.data?.message || e?.message || '搜索服务暂时不可用'
})

const seoTitle = computed(() => q.value
  ? `搜索「${q.value}」 · ${settings.value.siteName}`
  : `站内搜索 · ${settings.value.siteName}`)
const seoDesc = computed(() => q.value
  ? `在${settings.value.siteName}中搜索「${q.value}」，结果包含网站目录与用户公开收藏。`
  : `搜索${settings.value.siteName}收录的网站目录与用户公开收藏，支持名称、关键词、拼音和域名。`)
const emptyHint = computed(() => q.value
  ? `没有找到与「${q.value}」匹配的站点，可以换一个关键词，或试试下面的推荐词。`
  : '输入关键词搜索网站目录与用户公开收藏。')

useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogType: 'website',
  ogUrl: siteUrl + '/search',
  robots: () => (q.value ? 'noindex,follow' : 'index,follow')
})

useHead({
  link: [{ rel: 'canonical', href: siteUrl + '/search' }]
})

function buildHref(patch: Record<string, any>): string {
  const query: Record<string, any> = { ...route.query, ...patch }
  for (const key of Object.keys(query)) {
    if (query[key] === '' || query[key] === null || query[key] === undefined) delete query[key]
    if (key === 'page' && Number(query[key]) <= 1) delete query[key]
  }
  const qs = new URLSearchParams(query as Record<string, string>).toString()
  return '/search' + (qs ? `?${qs}` : '')
}

function go(patch: Record<string, any>) {
  router.push(buildHref(patch))
}

function submit(value: string) {
  go({ q: value, page: 1 })
}

function setSort(value: string) {
  go({ sort: value === 'relevance' ? undefined : value, page: 1 })
}

function setPage(value: number) {
  go({ page: value })
}

function setType(value: string) {
  go({
    type: value === 'all' ? undefined : value,
    category: value === 'all' || value === 'link' ? undefined : category.value || undefined,
    page: 1
  })
}

function setCategory(value: string) {
  go({
    category: value || undefined,
    type: value ? 'directory' : undefined,
    page: 1
  })
}

function onSuggestion(term: string) {
  go({ q: term, page: 1 })
}

function typeCount(value: string): number {
  return Number((counts.value as any)[value] || 0)
}

function trackClick(item: any) {
  const term = q.value
  if (!term) return
  const body = JSON.stringify({ term, type: item.type, id: item.id })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/search/click', new Blob([body], { type: 'application/json' }))
      return
    }
  } catch {}
  fetch('/api/search/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {})
}
</script>

<template>
  <SearchResultsPage
    title="站内搜索"
    description="搜索 2077 导航收录的网站目录与用户公开收藏，支持名称、关键词、拼音和域名。"
    badge="站内"
    placeholder="搜索目录站点、公开收藏、拼音或域名"
    :query="q"
    :sort="sort"
    :sort-options="SEARCH_SORT_OPTIONS"
    :loading="pending"
    :error="errorMessage"
    :total="total"
    count-suffix="条结果"
    :took="took"
    :incomplete="incomplete"
    empty-title="没有找到相关内容"
    :empty-hint="emptyHint"
    :suggestions="hot"
    :page="page"
    :page-count="pageCount"
    @submit="submit"
    @sort="setSort"
    @refresh="refresh"
    @page="setPage"
    @suggestion="onSuggestion"
  >
    <template #icon>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
    </template>

    <template #intro>
      <div class="mt-4 grid gap-3">
        <section class="card p-5">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-[15px] font-semibold m-0">搜索范围</h2>
            <span class="chip !text-[11px]">目录站点 + 公开收藏</span>
          </div>
          <p class="mt-2 text-[13px] leading-relaxed text-ink2">
            支持中文名称、关键词、英文、数字、拼音全拼和首字母。例如搜索「百度」「baidu」「bd」都能找到同一个站点。
          </p>
          <div class="mt-4 grid gap-2 sm:grid-cols-3">
            <div class="rounded-xl border border-line bg-card2/60 p-3">
              <div class="text-[12px] text-ink3">目录站点</div>
              <div class="mt-1 text-[13px] text-ink2">按名称、标题、简介、关键词和域名匹配</div>
            </div>
            <div class="rounded-xl border border-line bg-card2/60 p-3">
              <div class="text-[12px] text-ink3">公开收藏</div>
              <div class="mt-1 text-[13px] text-ink2">仅搜索用户主动设为公开的云端网址</div>
            </div>
            <div class="rounded-xl border border-line bg-card2/60 p-3">
              <div class="text-[12px] text-ink3">分类筛选</div>
              <div class="mt-1 text-[13px] text-ink2">先输入关键词，再按目录分类缩小范围</div>
            </div>
          </div>
        </section>

        <div class="grid gap-3 lg:grid-cols-2">
          <section v-if="hot.length" class="card p-5">
            <div class="flex items-center gap-2">
              <h2 class="text-[15px] font-semibold m-0">热门搜索</h2>
              <span class="text-[11.5px] text-ink3">来自站内搜索</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="term in hot"
                :key="term"
                type="button"
                class="chip hover:border-line2 hover:text-ink transition-colors"
                @click="onSuggestion(term)"
              >{{ term }}</button>
            </div>
          </section>

          <section v-if="categories.length" class="card p-5">
            <div class="flex items-center gap-2">
              <h2 class="text-[15px] font-semibold m-0">按分类浏览</h2>
              <NuxtLink to="/site" class="ml-auto text-[11.5px] text-ink3 hover:text-ink">进入网站目录</NuxtLink>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <NuxtLink
                v-for="cat in categories.slice(0, 24)"
                :key="cat.category"
                :to="`/site?category=${encodeURIComponent(cat.category)}`"
                class="chip hover:border-line2 hover:text-ink transition-colors"
              >{{ cat.category }} <span class="ml-1 text-ink3">{{ cat.n }}</span></NuxtLink>
            </div>
          </section>
        </div>
      </div>
    </template>

    <div class="card p-3 flex flex-wrap items-center gap-2">
      <span class="text-[11.5px] text-ink3">范围</span>
      <button
        v-for="option in SEARCH_TYPE_OPTIONS"
        :key="option.value"
        type="button"
        class="h-7 rounded-lg px-2.5 text-[12px] transition-colors"
        :class="type === option.value ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:bg-card2 hover:text-ink'"
        @click="setType(option.value)"
      >{{ option.label }}<span class="ml-1 opacity-60">{{ typeCount(option.value) }}</span></button>

      <span v-if="type !== 'link'" class="ml-1 text-[11.5px] text-ink3">分类</span>
      <select
        v-if="type !== 'link'"
        class="field !h-8 !w-auto min-w-[130px] !text-[12px]"
        :value="category"
        aria-label="按分类筛选"
        @change="setCategory(($event.target as HTMLSelectElement).value)"
      >
        <option value="">全部分类</option>
        <option v-for="cat in categories" :key="cat.category" :value="cat.category">{{ cat.category }}（{{ cat.n }}）</option>
      </select>

      <button
        v-if="category || type !== 'all'"
        type="button"
        class="ml-auto text-[11.5px] text-ink3 hover:text-ink"
        @click="go({ type: undefined, category: undefined, page: 1 })"
      >清除筛选</button>
    </div>

    <SearchResultCard
      v-for="item in items"
      :key="`${item.type}-${item.id}`"
      :item="item"
      :query="q"
      @open="trackClick(item)"
    />
  </SearchResultsPage>
</template>
