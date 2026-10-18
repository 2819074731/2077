<script setup lang="ts">
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
}

interface SearchResult {
  items: Repo[]
  total: number
  incomplete: boolean
}

const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl

const query = computed(() => String(route.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 80))
const sort = computed(() => {
  const value = String(route.query.sort || 'best')
  return ['stars', 'forks', 'updated'].includes(value) ? value : 'best'
})
const page = computed(() => Math.max(1, Math.min(20, Number.parseInt(String(route.query.page || '1'), 10) || 1)))

const SORTS = [
  { value: 'best', label: '最佳匹配' },
  { value: 'stars', label: 'Star 最多' },
  { value: 'forks', label: 'Fork 最多' },
  { value: 'updated', label: '最近更新' }
]

const HOT_QUERIES = ['nuxt', 'awesome lists', 'llm', 'self-hosted', 'typescript', 'rust']

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
const pageCount = computed(() => Math.min(20, Math.max(1, Math.ceil(total.value / 20))))
const errorMessage = computed(() => {
  const e: any = error.value
  return e?.data?.statusMessage || e?.statusMessage || '搜索失败，请稍后重试'
})

useSeoMeta({
  title: () => query.value ? `${query.value} · GitHub 项目搜索` : 'GitHub 项目搜索',
  description: '搜索 GitHub 仓库，查看项目文件、Release 与源码下载。',
  ogTitle: () => query.value ? `${query.value} · GitHub 项目搜索` : 'GitHub 项目搜索',
  ogDescription: '搜索 GitHub 仓库，查看项目文件、Release 与源码下载。'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}/github` }],
  meta: [{ name: 'robots', content: 'noindex, follow' }]
}))

function pushSearch(text: string, nextSort = sort.value, nextPage = 1) {
  router.push({
    path: '/github',
    query: {
      q: text,
      ...(nextSort !== 'best' ? { sort: nextSort } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {})
    }
  })
}

function submit(text: string) {
  pushSearch(text)
}

function changeSort(value: string) {
  if (!query.value) return
  pushSearch(query.value, ['stars', 'forks', 'updated'].includes(value) ? value : 'best')
}

function goPage(value: number) {
  pushSearch(query.value, sort.value, value)
}

function tryQuery(term: string) {
  pushSearch(term)
}
</script>

<template>
  <SearchResultsPage
    title="GitHub 项目搜索"
    description="搜索仓库，查看项目文件、Release 与源码下载"
    badge="仓库搜索"
    placeholder="搜索仓库，支持 language:typescript stars:&gt;1000 等语法"
    :query="query"
    :sort="sort"
    :sort-options="SORTS"
    :loading="loading"
    :error="error ? errorMessage : ''"
    :total="total"
    count-suffix="个仓库"
    :incomplete="!!data?.incomplete"
    empty-title="没有找到相关仓库"
    empty-hint="换一个关键词，或去掉过窄的筛选条件再试。"
    :suggestions="HOT_QUERIES"
    :page="page"
    :page-count="pageCount"
    @submit="submit"
    @sort="changeSort"
    @refresh="refresh"
    @page="goPage"
    @suggestion="tryQuery"
  >
    <template #icon>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.5v-1.8c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z" /></svg>
    </template>

    <template #intro>
      <section class="card p-5 sm:p-7 mt-4">
        <h2 class="text-[15px] font-semibold">搜索、浏览、下载，都在当前站点完成</h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-3 text-[12.5px] text-ink2">
          <div class="rounded-xl border border-line bg-card2 p-4">
            <p class="font-medium text-ink mb-1">仓库搜索</p>
            <p class="leading-relaxed">查看简介、Star、Fork、语言、许可证与更新时间。</p>
          </div>
          <div class="rounded-xl border border-line bg-card2 p-4">
            <p class="font-medium text-ink mb-1">文件浏览</p>
            <p class="leading-relaxed">进入项目即可查看目录与文件内容，无需跳转 GitHub。</p>
          </div>
          <div class="rounded-xl border border-line bg-card2 p-4">
            <p class="font-medium text-ink mb-1">版本下载</p>
            <p class="leading-relaxed">获取默认分支源码 ZIP 与最新 Release 附件。</p>
          </div>
        </div>
      </section>
    </template>

    <GithubRepoCard v-for="repo in items" :key="repo.fullName" :repo="repo" />
  </SearchResultsPage>
</template>
