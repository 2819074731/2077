<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Repo {
  id: number
  fullName: string
  owner: string
  name: string
  description: string
  stars: number
  forks: number
  issues: number
  language: string
  license: string
  topics: string[]
  updatedAt: string
  pushedAt: string
  archived: boolean
  fork: boolean
  avatar?: string
}

interface SearchResult {
  items: Repo[]
  total: number
  incomplete: boolean
}

const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl
const { settings, loadSiteSettings } = useSiteSettings()
await loadSiteSettings()

const gh = computed(() => settings.value.github)

const query = computed(() => String(route.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 80))
const sort = computed(() => {
  const value = String(route.query.sort || gh.value.defaultSort)
  return ['stars', 'forks', 'updated'].includes(value) ? value : gh.value.defaultSort
})
const page = computed(() => Math.max(1, Math.min(gh.value.maxPages, Number.parseInt(String(route.query.page || '1'), 10) || 1)))

const SORTS = [
  { value: 'best', label: '最佳匹配' },
  { value: 'stars', label: 'Star 最多' },
  { value: 'forks', label: 'Fork 最多' },
  { value: 'updated', label: '最近更新' }
]

const HOT_QUERIES = ['maccms', 'nuxt', 'self-hosted', 'llm', 'typescript', 'rust']

const FILTERS = [
  { code: 'language:php', label: '按语言' },
  { code: 'stars:>1000', label: '高 Star' },
  { code: 'topic:cms', label: '按主题' },
  { code: 'forks:>100', label: '高 Fork' },
  { code: 'pushed:>2025-01-01', label: '近期活跃' }
]

const inputEl = ref<HTMLInputElement | null>(null)
const input = ref(query.value)
watch(query, value => { input.value = value })

const { data, pending, error, refresh } = await useAsyncData<SearchResult | null>(
  () => `github-search:${query.value}:${sort.value}:${page.value}`,
  () => query.value
    ? $fetch<SearchResult>('/api/github/search', {
        query: { q: query.value, sort: sort.value, page: page.value }
      })
    : Promise.resolve(null),
  { server: false, watch: [query, sort, page] }
)

const loading = computed(() => pending.value || (!data.value && !error.value))
const items = computed(() => data.value?.items || [])
const total = computed(() => data.value?.total || 0)
const pageCount = computed(() => Math.min(gh.value.maxPages, Math.max(1, Math.ceil(total.value / Math.max(10, gh.value.pageSize)))))
const errorMessage = computed(() => {
  const e: any = error.value
  return e?.data?.statusMessage || e?.statusMessage || '搜索失败，请稍后重试'
})

const pageNumbers = computed(() => {
  const current = page.value
  const count = pageCount.value
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1) as Array<number | '...'>
  const pages = new Set<number>([1, count, current - 1, current, current + 1])
  if (current <= 3) [2, 3, 4].forEach(value => pages.add(value))
  if (current >= count - 2) [count - 3, count - 2, count - 1].forEach(value => pages.add(value))
  const sorted = [...pages].filter(value => value >= 1 && value <= count).sort((a, b) => a - b)
  const result: Array<number | '...'> = []
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push('...')
    result.push(value)
  })
  return result
})

useSeoMeta({
  title: () => query.value ? `${query.value} · GitHub 项目搜索` : 'GitHub 项目搜索',
  description: '搜索 GitHub 仓库，阅读 README、Issues、提交与版本。',
  ogTitle: () => query.value ? `${query.value} · GitHub 项目搜索` : 'GitHub 项目搜索',
  ogDescription: '搜索 GitHub 仓库，阅读 README、Issues、提交与版本。'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}/github` }],
  meta: [{ name: 'robots', content: 'noindex, follow' }]
}))

function pushSearch(text: string, nextSort = sort.value, nextPage = 1) {
  const value = text.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (!value) return
  router.push({
    path: '/github',
    query: {
      q: value,
      ...(nextSort !== gh.value.defaultSort ? { sort: nextSort } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {})
    }
  })
}

function submit() {
  pushSearch(input.value)
}

function changeSort(value: string) {
  if (!query.value) return
  pushSearch(query.value, ['stars', 'forks', 'updated'].includes(value) ? value : gh.value.defaultSort)
}

function addFilter(code: string) {
  if (!query.value) {
    pushSearch(code)
    return
  }
  if (query.value.includes(code)) return
  pushSearch(`${query.value} ${code}`)
}

function goPage(value: number | string) {
  const target = typeof value === 'number' ? value : Number.NaN
  if (!Number.isInteger(target) || target < 1 || target > pageCount.value) return
  pushSearch(query.value, sort.value, target)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  event.preventDefault()
  inputEl.value?.focus()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="mx-auto max-w-wrap px-4 pb-12 pt-4 sm:pt-6">
    <div class="mb-4 flex items-center justify-between gap-3">
      <NuxtLink to="/" class="inline-flex items-center gap-1.5 text-[12.5px] text-ink2 transition-colors hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        返回首页
      </NuxtLink>
      <span class="hidden items-center gap-1.5 text-[11.5px] text-ink3 sm:flex">
        <kbd class="rounded border border-line bg-card px-1.5 font-mono text-[10.5px]">/</kbd>
        快速聚焦搜索
      </span>
    </div>

    <header>
      <div class="flex items-center gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-bg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.5v-1.8c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z" /></svg>
        </span>
        <div class="min-w-0">
          <h1 class="text-[19px] font-bold tracking-tight sm:text-[23px]">GitHub 项目搜索</h1>
          <p class="mt-0.5 text-[12px] leading-relaxed text-ink2 sm:text-[12.5px]">搜索仓库，默认阅读 README，并查看 Issues、提交与版本</p>
        </div>
      </div>

      <form class="mt-4" @submit.prevent="submit">
        <div class="flex gap-2">
          <label class="relative min-w-0 flex-1">
            <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            <input
              ref="inputEl"
              v-model="input"
              class="field !h-12 !rounded-xl pl-10 pr-10 text-[14.5px]"
              placeholder="搜索仓库，支持 language:php stars:>1000 等语法"
              autocomplete="off"
              spellcheck="false"
              enterkeyhint="search"
              aria-label="搜索 GitHub 仓库"
            />
            <button
              v-if="input"
              type="button"
              class="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ink3 hover:bg-card2 hover:text-ink"
              aria-label="清空搜索"
              @click="input = ''; inputEl?.focus()"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </label>
          <button type="submit" class="btn btn-primary !h-12 shrink-0 px-5 sm:px-6">搜索</button>
        </div>
      </form>

      <div class="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <span class="shrink-0 text-[11.5px] text-ink3">排序</span>
        <button
          v-for="option in SORTS"
          :key="option.value"
          type="button"
          class="h-7 shrink-0 rounded-full px-2.5 text-[12px] font-medium transition-colors"
          :class="sort === option.value ? 'bg-ink text-bg' : 'text-ink2 hover:bg-card2 hover:text-ink'"
          :disabled="!query"
          @click="changeSort(option.value)"
        >{{ option.label }}</button>
        <template v-if="!query">
          <span class="mx-1 h-3 w-px shrink-0 bg-line" />
          <button
            v-for="term in HOT_QUERIES.slice(0, 4)"
            :key="term"
            type="button"
            class="h-7 shrink-0 rounded-full border border-line px-2.5 text-[12px] text-ink2 transition-colors hover:border-line2 hover:text-ink"
            @click="pushSearch(term)"
          >{{ term }}</button>
        </template>
      </div>
    </header>

    <template v-if="!query">
      <section class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="card flex gap-3 p-4">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card2 text-ink2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          </span>
          <div>
            <p class="text-[13px] font-semibold">仓库搜索</p>
            <p class="mt-0.5 text-[12px] leading-relaxed text-ink2">按名称、语言、Star 与主题筛选项目。</p>
          </div>
        </div>
        <div class="card flex gap-3 p-4">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card2 text-ink2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v14H4zM8 9h8M8 13h5" /></svg>
          </span>
          <div>
            <p class="text-[13px] font-semibold">README 与文件</p>
            <p class="mt-0.5 text-[12px] leading-relaxed text-ink2">直接阅读项目说明，浏览目录与源码文件。</p>
          </div>
        </div>
        <div class="card flex gap-3 p-4">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card2 text-ink2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>
          </span>
          <div>
            <p class="text-[13px] font-semibold">版本与下载</p>
            <p class="mt-0.5 text-[12px] leading-relaxed text-ink2">查看提交、Issue、Release 并获取源码。</p>
          </div>
        </div>
      </section>

      <section class="mt-6">
        <h2 class="text-[13px] font-semibold">热门搜索</h2>
        <div class="mt-2.5 flex flex-wrap gap-2">
          <button
            v-for="term in HOT_QUERIES"
            :key="term"
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-[12.5px] text-ink2 transition-colors hover:border-line2 hover:text-ink"
            @click="pushSearch(term)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            {{ term }}
          </button>
        </div>
      </section>

      <section class="card mt-6 p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-[13px] font-semibold">搜索语法</h2>
          <span class="text-[11px] text-ink3">点击直接使用</span>
        </div>
        <div class="mt-2.5 grid gap-1 sm:grid-cols-2">
          <button
            v-for="item in FILTERS"
            :key="item.code"
            type="button"
            class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-card2"
            @click="addFilter(item.code)"
          >
            <code class="truncate text-[11.5px] text-ink">{{ item.code }}</code>
            <span class="shrink-0 text-[11px] text-ink3">{{ item.label }}</span>
          </button>
        </div>
      </section>
    </template>

    <div v-else class="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_264px]">
      <section class="min-w-0">
        <div class="mb-2.5 flex min-h-8 items-center justify-between gap-3">
          <div class="min-w-0 text-[12.5px] text-ink2">
            <template v-if="loading">
              正在搜索「<span class="text-ink">{{ query }}</span>」…
            </template>
            <template v-else-if="error">
              搜索未完成
            </template>
            <template v-else>
              找到 <span class="font-semibold text-ink">{{ total.toLocaleString('zh-CN') }}</span> 个仓库
              <span v-if="data?.incomplete" class="text-ink3">（结果可能不完整）</span>
            </template>
          </div>
          <button class="btn btn-ghost btn-sm btn-icon-sm shrink-0" :disabled="loading" title="刷新结果" aria-label="刷新结果" @click="refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'animate-spin': loading }"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
          </button>
        </div>

        <div class="no-scrollbar -mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 lg:hidden">
          <button
            v-for="item in FILTERS"
            :key="item.code"
            type="button"
            class="h-7 shrink-0 rounded-full border border-line px-2.5 text-[11.5px] transition-colors"
            :class="query.includes(item.code) ? 'border-line2 bg-card2 text-ink' : 'text-ink2 hover:text-ink'"
            @click="addFilter(item.code)"
          >{{ item.label }}</button>
        </div>

        <div v-if="loading" class="card overflow-hidden">
          <div v-for="n in 6" :key="n" class="flex animate-pulse gap-3 border-b border-line px-4 py-4 last:border-0 sm:px-5">
            <div class="h-9 w-9 shrink-0 rounded-lg bg-card2 sm:h-10 sm:w-10" />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-3.5 w-1/3 rounded bg-card2" />
              <div class="h-3 w-4/5 rounded bg-card2" />
              <div class="h-3 w-1/2 rounded bg-card2" />
            </div>
          </div>
        </div>

        <div v-else-if="error" class="card p-9 text-center">
          <p class="text-[14px] font-semibold">搜索失败</p>
          <p class="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{{ errorMessage }}</p>
          <button class="btn btn-primary btn-sm mt-4" @click="refresh">重新搜索</button>
        </div>

        <div v-else-if="!items.length" class="card p-9 text-center">
          <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-card2 text-ink3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          </span>
          <p class="mt-3 text-[14px] font-semibold">没有找到「{{ query }}」相关仓库</p>
          <p class="mt-1 text-[12.5px] text-ink2">试试更短的关键词，或去掉 stars、topic 等筛选条件。</p>
          <div class="mt-4 flex flex-wrap justify-center gap-2">
            <button v-for="term in HOT_QUERIES.slice(0, 4)" :key="term" type="button" class="chip hover:text-ink" @click="pushSearch(term)">{{ term }}</button>
          </div>
        </div>

        <template v-else>
          <div class="card divide-y divide-line overflow-hidden">
            <GithubRepoCard v-for="repo in items" :key="repo.fullName" :repo="repo" />
          </div>

          <nav v-if="pageCount > 1" class="mt-4 flex items-center justify-between gap-2 sm:justify-center" aria-label="搜索结果分页">
            <button class="btn btn-sm btn-ghost" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
            <div class="hidden items-center gap-1 sm:flex">
              <template v-for="(item, index) in pageNumbers" :key="`${item}-${index}`">
                <span v-if="item === '...'" class="grid h-8 w-6 place-items-center text-[12px] text-ink3">…</span>
                <button
                  v-else
                  class="h-8 min-w-8 rounded-lg px-2 text-[12.5px] font-medium transition-colors"
                  :class="item === page ? 'bg-ink text-bg' : 'text-ink2 hover:bg-card2 hover:text-ink'"
                  :aria-current="item === page ? 'page' : undefined"
                  @click="goPage(item)"
                >{{ item }}</button>
              </template>
            </div>
            <span class="text-[12px] tabular-nums text-ink2 sm:hidden">{{ page }} / {{ pageCount }}</span>
            <button class="btn btn-sm btn-ghost" :disabled="page >= pageCount" @click="goPage(page + 1)">下一页</button>
          </nav>
        </template>
      </section>

      <aside class="hidden lg:block">
        <div class="pt-[42px]">
          <div class="sticky top-20 space-y-3">
            <section class="card p-4">
              <h2 class="text-[13px] font-semibold">搜索语法</h2>
              <p class="mt-0.5 text-[11.5px] text-ink3">组合使用可缩小结果范围</p>
              <div class="mt-2 -mx-2">
                <button
                  v-for="item in FILTERS"
                  :key="item.code"
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-card2"
                  @click="addFilter(item.code)"
                >
                  <code class="truncate text-[11.5px] text-ink">{{ item.code }}</code>
                  <span class="shrink-0 text-[10.5px] text-ink3">{{ item.label }}</span>
                </button>
              </div>
            </section>
            <section class="card p-4">
              <h2 class="text-[13px] font-semibold">热门搜索</h2>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button v-for="term in HOT_QUERIES" :key="term" type="button" class="chip hover:text-ink" @click="pushSearch(term)">{{ term }}</button>
              </div>
            </section>
            <p class="px-1 text-[11px] leading-relaxed text-ink3">
              搜索结果来自 GitHub，项目内容与下载在本站内完成。
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
