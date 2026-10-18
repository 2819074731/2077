<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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

interface Asset {
  id: number
  name: string
  size: number
  downloads: number
  contentType: string
}

interface Release {
  tag: string
  name: string
  publishedAt: string
  assets: Asset[]
}

interface DownloadState {
  open: boolean
  loading: boolean
  release: Release | null
  error: string
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

const input = ref(query.value)
const sortDraft = ref(sort.value)

watch(query, (value) => { input.value = value })
watch(sort, (value) => { sortDraft.value = value })

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

const HOT_QUERIES = ['nuxt', 'awesome lists', 'llm', 'self-hosted', 'typescript', 'rust']

const downloadStates = ref<Record<string, DownloadState>>({})
const releaseCache = new Map<string, Release | null>()

useSeoMeta({
  title: () => query.value ? `${query.value} · GitHub 搜索` : 'GitHub 站内搜索',
  description: '在站内搜索 GitHub 仓库，直接下载源码 ZIP 与 Release 文件，无需访问 GitHub。',
  ogTitle: () => query.value ? `${query.value} · GitHub 搜索` : 'GitHub 站内搜索',
  ogDescription: '在站内搜索 GitHub 仓库，直接下载源码 ZIP 与 Release 文件。'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}/github` }],
  meta: [{ name: 'robots', content: 'noindex, follow' }]
}))

function submit() {
  const text = input.value.replace(/\s+/g, ' ').trim()
  if (!text) return
  router.push({
    path: '/github',
    query: {
      q: text,
      ...(sortDraft.value !== 'best' ? { sort: sortDraft.value } : {})
    }
  })
}

function changeSort() {
  if (query.value) submit()
}

function goPage(value: number) {
  if (value < 1 || value > pageCount.value) return
  router.push({
    path: '/github',
    query: {
      q: query.value,
      ...(sort.value !== 'best' ? { sort: sort.value } : {}),
      ...(value > 1 ? { page: String(value) } : {})
    }
  })
}

function tryQuery(term: string) {
  input.value = term
  submit()
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function formatBytes(value: number): string {
  const size = Number(value) || 0
  if (size <= 0) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Vue: '#41b883',
  Python: '#3572a5',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  PHP: '#4f5d95',
  Ruby: '#701516',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Dart: '#00b4ab',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Lua: '#000080',
  Zig: '#ec915c'
}

function languageColor(value: string): string {
  return LANGUAGE_COLORS[value] || '#8b949e'
}

function initial(value: string): string {
  return (value || '?').slice(0, 1).toUpperCase()
}

function avatarStyle(value: string): Record<string, string> {
  let hash = 0
  for (const char of value || '?') hash = (hash * 31 + char.charCodeAt(0)) % 360
  return {
    background: `linear-gradient(135deg, hsl(${hash} 62% 52%), hsl(${(hash + 42) % 360} 58% 42%))`
  }
}

function stateFor(repo: Repo): DownloadState | undefined {
  return downloadStates.value[repo.fullName]
}

function releaseFor(repo: Repo): Release | null {
  return stateFor(repo)?.release || null
}

function zipHref(repo: Repo): string {
  return `/api/github/download?repo=${encodeURIComponent(repo.fullName)}&kind=zip`
}

function assetHref(repo: Repo, asset: Asset): string {
  return `/api/github/download?repo=${encodeURIComponent(repo.fullName)}&kind=asset&id=${asset.id}&name=${encodeURIComponent(asset.name)}`
}

async function toggleDownload(repo: Repo) {
  const key = repo.fullName
  const current = downloadStates.value[key]
  if (current?.open) {
    current.open = false
    return
  }

  const cached = releaseCache.has(key) ? releaseCache.get(key) || null : null
  downloadStates.value[key] = {
    open: true,
    loading: !releaseCache.has(key),
    release: cached,
    error: ''
  }
  if (releaseCache.has(key)) return

  try {
    const result = await $fetch<{ release: Release | null }>('/api/github/release', { query: { repo: key } })
    releaseCache.set(key, result.release)
    const state = downloadStates.value[key]
    if (state) {
      state.loading = false
      state.release = result.release
    }
  } catch (e: any) {
    const state = downloadStates.value[key]
    if (state) {
      state.loading = false
      state.error = e?.data?.statusMessage || e?.statusMessage || 'Release 读取失败'
    }
  }
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-8 sm:py-10">
    <NuxtLink to="/" class="btn btn-ghost btn-sm mb-4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
      返回首页
    </NuxtLink>

    <section class="card p-5 sm:p-7">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div class="flex items-center gap-2">
            <span class="grid place-items-center w-8 h-8 rounded-xl bg-ink text-bg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.5v-1.8c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z" /></svg>
            </span>
            <div>
              <h1 class="text-[22px] sm:text-[26px] font-bold tracking-tight leading-tight">GitHub 站内搜索</h1>
              <p class="text-[12px] text-ink2 mt-0.5">搜索结果与下载文件均由本站代理，访问 GitHub 不稳定时也能用</p>
            </div>
          </div>
        </div>
        <span class="chip">仓库搜索</span>
      </div>

      <form class="mt-5 flex flex-col sm:flex-row gap-2" @submit.prevent="submit">
        <input
          v-model="input"
          class="field flex-1 !h-11 sm:!h-[42px]"
          placeholder="搜索仓库，支持 language:typescript stars:&gt;1000 等语法"
          autocomplete="off"
          spellcheck="false"
          aria-label="搜索 GitHub 仓库"
        />
        <select v-model="sortDraft" class="field sm:w-36 !h-11 sm:!h-[42px]" aria-label="排序方式" @change="changeSort">
          <option value="best">最佳匹配</option>
          <option value="stars">Star 最多</option>
          <option value="forks">Fork 最多</option>
          <option value="updated">最近更新</option>
        </select>
        <button type="submit" class="btn btn-primary !h-11 sm:!h-[42px] px-5">搜索</button>
      </form>

      <div v-if="!query" class="mt-5 flex items-center gap-2 flex-wrap text-[12.5px] text-ink2">
        <span>试试：</span>
        <button
          v-for="term in HOT_QUERIES"
          :key="term"
          type="button"
          class="chip hover:border-line2 hover:text-ink transition-colors"
          @click="tryQuery(term)"
        >{{ term }}</button>
      </div>
    </section>

    <section v-if="!query" class="card p-6 sm:p-8 mt-4">
      <h2 class="text-[15px] font-semibold">不用打开 GitHub，也能搜项目、下文件</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-3 text-[12.5px] text-ink2">
        <div class="rounded-xl border border-line bg-card2 p-4">
          <p class="font-medium text-ink mb-1">站内结果</p>
          <p class="leading-relaxed">仓库简介、Star、Fork、语言、许可证与更新时间直接展示。</p>
        </div>
        <div class="rounded-xl border border-line bg-card2 p-4">
          <p class="font-medium text-ink mb-1">源码 ZIP</p>
          <p class="leading-relaxed">一键下载默认分支源码，由本站服务器中转。</p>
        </div>
        <div class="rounded-xl border border-line bg-card2 p-4">
          <p class="font-medium text-ink mb-1">Release 附件</p>
          <p class="leading-relaxed">读取最新 Release，列出安装包、压缩包等附件并代理下载。</p>
        </div>
      </div>
    </section>

    <section v-else class="mt-4">
      <div class="flex items-center justify-between gap-3 mb-3 min-h-8">
        <p class="text-[12.5px] text-ink2">
          <template v-if="loading">正在搜索「{{ query }}」…</template>
          <template v-else-if="error">搜索未完成</template>
          <template v-else>
            约 {{ formatNumber(total) }} 个仓库
            <span v-if="data?.incomplete" class="text-ink3">（GitHub 返回结果不完整）</span>
          </template>
        </p>
        <button class="btn btn-ghost btn-sm" :disabled="loading" @click="refresh()">刷新</button>
      </div>

      <div v-if="loading" class="grid gap-3">
        <div v-for="n in 4" :key="n" class="card p-5 animate-pulse">
          <div class="flex gap-4">
            <div class="w-10 h-10 rounded-xl bg-card2 shrink-0" />
            <div class="flex-1 space-y-2.5">
              <div class="h-4 w-1/3 rounded bg-card2" />
              <div class="h-3 w-4/5 rounded bg-card2" />
              <div class="h-3 w-1/2 rounded bg-card2" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="card p-8 text-center">
        <p class="text-[14px] font-medium">搜索失败</p>
        <p class="mt-1 text-[12.5px] text-ink2">{{ errorMessage }}</p>
        <button class="btn btn-sm btn-primary mt-4" @click="refresh()">重试</button>
      </div>

      <div v-else-if="!items.length" class="card p-8 text-center">
        <p class="text-[14px] font-medium">没有找到相关仓库</p>
        <p class="mt-1 text-[12.5px] text-ink2">换一个关键词，或去掉过窄的筛选条件再试。</p>
      </div>

      <div v-else class="grid gap-3">
        <article v-for="repo in items" :key="repo.fullName" class="card min-w-0 p-4 sm:p-5">
          <div class="flex gap-3 sm:gap-4">
            <div class="grid place-items-center w-10 h-10 rounded-xl text-white text-[13px] font-bold shrink-0" :style="avatarStyle(repo.owner)">
              {{ initial(repo.owner) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[12.5px] text-ink2">{{ repo.owner }} /</span>
                <h2 class="text-[15px] font-semibold break-all">{{ repo.name }}</h2>
                <span v-if="repo.archived" class="chip">已归档</span>
                <span v-if="repo.fork" class="chip">Fork</span>
              </div>

              <p v-if="repo.description" class="mt-1.5 text-[13px] leading-relaxed text-ink2 line-clamp-2">{{ repo.description }}</p>

              <div class="mt-3 flex items-center gap-3 text-[12px] text-ink2 flex-wrap">
                <span class="inline-flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" /></svg>
                  {{ formatNumber(repo.stars) }}
                </span>
                <span>Fork {{ formatNumber(repo.forks) }}</span>
                <span v-if="repo.language" class="inline-flex items-center gap-1.5">
                  <i class="w-2 h-2 rounded-full" :style="{ background: languageColor(repo.language) }" />
                  {{ repo.language }}
                </span>
                <span v-if="repo.license">{{ repo.license }}</span>
                <span v-if="repo.updatedAt">更新于 {{ formatDate(repo.updatedAt) }}</span>
              </div>

              <div v-if="repo.topics.length" class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="topic in repo.topics" :key="topic" class="chip">{{ topic }}</span>
              </div>

              <div class="mt-3.5 flex items-center gap-2 flex-wrap">
                <button class="btn btn-sm btn-primary" @click="toggleDownload(repo)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>
                  下载
                </button>
                <span class="text-[11.5px] text-ink3">源码 ZIP 与 Release 文件由本站代理</span>
              </div>

              <div v-if="downloadStates[repo.fullName]?.open" class="mt-3 rounded-xl border border-line bg-card2 p-3">
                <div v-if="downloadStates[repo.fullName]?.loading" class="px-1 py-1 text-[12.5px] text-ink2">正在读取最新 Release…</div>
                <template v-else>
                  <div class="flex flex-col gap-1.5">
                    <a :href="zipHref(repo)" class="flex items-center justify-between gap-3 min-h-9 px-3 py-1.5 rounded-lg bg-card border border-line text-[13px] hover:border-line2 transition-colors">
                      <span class="inline-flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h6l2 2h8v12H4z" /></svg>
                        源码 ZIP
                      </span>
                      <span class="text-[11px] text-ink3">默认分支 · HEAD</span>
                    </a>

                    <template v-if="releaseFor(repo)">
                      <div class="px-1 pt-1 text-[11.5px] text-ink3">
                        最新 Release：{{ releaseFor(repo)?.tag }}
                        <span v-if="releaseFor(repo)?.publishedAt"> · {{ formatDate(releaseFor(repo)?.publishedAt || '') }}</span>
                      </div>
                      <a
                        v-for="asset in releaseFor(repo)?.assets || []"
                        :key="asset.id"
                        :href="assetHref(repo, asset)"
                        class="flex items-center justify-between gap-3 min-h-9 px-3 py-1.5 rounded-lg bg-card border border-line text-[13px] hover:border-line2 transition-colors"
                      >
                        <span class="truncate min-w-0">{{ asset.name }}</span>
                        <span class="text-[11px] text-ink3 shrink-0">{{ formatBytes(asset.size) }}</span>
                      </a>
                      <p v-if="!releaseFor(repo)?.assets?.length" class="px-1 text-[12px] text-ink2">
                        该 Release 没有附件，可下载上方源码 ZIP。
                      </p>
                    </template>

                    <p v-if="stateFor(repo)?.error" class="px-1 text-[12px] text-danger">
                      {{ stateFor(repo)?.error }}，仍可下载源码 ZIP。
                    </p>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-if="!pending && !error && pageCount > 1" class="mt-5 flex items-center justify-center gap-2">
        <button class="btn btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
        <span class="text-[12px] text-ink2">第 {{ page }} / {{ pageCount }} 页</span>
        <button class="btn btn-sm" :disabled="page >= pageCount" @click="goPage(page + 1)">下一页</button>
      </div>
    </section>
  </div>
</template>
