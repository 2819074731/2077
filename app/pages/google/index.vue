<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Item {
  title: string
  url: string
  displayUrl: string
  snippet: string
}

interface SearchResult {
  q: string
  page: number
  pageSize: number
  items: Item[]
  hasMore: boolean
  relay: string
  cached: boolean
  tookMs: number
}

const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl
const { settings, loadSiteSettings } = useSiteSettings()
await loadSiteSettings()

const google = computed(() => settings.value.google)
const query = computed(() => String(route.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 120))
const page = computed(() => Math.max(1, Math.min(google.value.maxPages, Number.parseInt(String(route.query.page || '1'), 10) || 1)))

const HOT_QUERIES = ['Nuxt 4', 'Vue 3 组合式 API', 'TypeScript 泛型', 'Linux 命令', 'Docker 教程', 'DeepSeek']

const inputEl = ref<HTMLInputElement | null>(null)
const input = ref(query.value)
watch(query, value => { input.value = value })

const { data, pending, error, refresh } = await useAsyncData<SearchResult | null>(
  () => `google-search:${query.value}:${page.value}`,
  () => query.value
    ? $fetch<SearchResult>('/api/google/search', { query: { q: query.value, page: page.value } })
    : Promise.resolve(null),
  { server: false, watch: [query, page] }
)

const loading = computed(() => pending.value || (!data.value && !error.value))
const items = computed(() => data.value?.items || [])
const hasMore = computed(() => !!data.value?.hasMore)
const externalUrl = computed(() => `https://www.google.com/search?q=${encodeURIComponent(query.value)}`)
const errorMessage = computed(() => {
  const e: any = error.value
  return e?.data?.statusMessage || e?.statusMessage || '搜索失败，请稍后重试'
})
const needsSetup = computed(() => /尚未配置/.test(errorMessage.value))

const reported = new Set<string>()
watch([data, error, query, page], () => {
  if (!query.value || page.value !== 1 || error.value || !data.value) return
  const key = `${query.value}:${data.value.items.length}`
  if (reported.has(key)) return
  reported.add(key)
  $fetch('/api/search/result', {
    method: 'POST',
    body: { engine: 'google', term: query.value, results: Number(data.value.items.length || 0) }
  }).catch(() => {})
}, { immediate: true })

useSeoMeta({
  title: () => query.value ? `${query.value} · Google 搜索` : 'Google 搜索',
  description: '站内 Google 搜索，通过第三方中转获取结果，无需跳转。',
  ogTitle: () => query.value ? `${query.value} · Google 搜索` : 'Google 搜索',
  ogDescription: '站内 Google 搜索，通过第三方中转获取结果，无需跳转。'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}/google` }],
  meta: [{ name: 'robots', content: 'noindex, follow' }]
}))

function iconOf(url: string): string {
  try { return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}` } catch { return '' }
}

function pushSearch(text: string, nextPage = 1) {
  const value = text.replace(/\s+/g, ' ').trim().slice(0, 120)
  if (!value) return
  router.push({
    path: '/google',
    query: {
      q: value,
      ...(nextPage > 1 ? { page: String(nextPage) } : {})
    }
  })
}

function submit() {
  pushSearch(input.value)
}

function goPage(value: number) {
  if (!Number.isInteger(value) || value < 1) return
  pushSearch(query.value, value)
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.35 11.1H12v2.9h5.35c-.25 1.4-1.03 2.6-2.2 3.4v2.8h3.55c2.08-1.9 3.28-4.7 3.28-8 0-.55-.05-1.08-.13-1.6Z" /><path d="M12 22c2.95 0 5.42-.98 7.22-2.65l-3.55-2.8c-.98.66-2.23 1.05-3.67 1.05-2.82 0-5.2-1.9-6.06-4.46H2.27v2.9A10 10 0 0 0 12 22Z" /><path d="M5.94 13.14a6 6 0 0 1 0-3.83V6.4H2.27a10 10 0 0 0 0 8.65l3.67-2.9Z" /><path d="M12 4.4c1.6 0 3.04.55 4.17 1.63l3.12-3.12A10 10 0 0 0 2.27 6.4l3.67 2.9C6.8 6.3 9.18 4.4 12 4.4Z" /></svg>
        </span>
        <div class="min-w-0">
          <h1 class="text-[19px] font-bold tracking-tight sm:text-[23px]">Google 搜索</h1>
          <p class="mt-0.5 text-[12px] leading-relaxed text-ink2 sm:text-[12.5px]">经第三方中转在站内查看结果，免跳转、免翻墙</p>
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
              placeholder="输入关键词，回车搜索"
              autocomplete="off"
              spellcheck="false"
              enterkeyhint="search"
              aria-label="搜索 Google"
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
    </header>

    <template v-if="!query">
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

      <section class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="card p-4">
          <p class="text-[13px] font-semibold">站内结果</p>
          <p class="mt-1 text-[12px] leading-relaxed text-ink2">结果经中转抓取后在本站渲染，打开链接直达原网页。</p>
        </div>
        <div class="card p-4">
          <p class="text-[13px] font-semibold">中转优先</p>
          <p class="mt-1 text-[12px] leading-relaxed text-ink2">多条线路按健康度排序，失败自动切换并缓存结果。</p>
        </div>
        <div class="card p-4">
          <p class="text-[13px] font-semibold">随时回退</p>
          <p class="mt-1 text-[12px] leading-relaxed text-ink2">任意时刻可跳转 Google 官方页面查看完整结果。</p>
        </div>
      </section>
    </template>

    <div v-else class="mt-5">
      <div class="mb-2.5 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <div class="min-w-0 text-[12.5px] text-ink2">
          <template v-if="loading">正在搜索「<span class="text-ink">{{ query }}</span>」…</template>
          <template v-else-if="error">搜索未完成</template>
          <template v-else>
            第 <span class="font-semibold text-ink">{{ page }}</span> 页 · {{ items.length }} 条结果
            <span v-if="data?.cached" class="text-ink3">（缓存）</span>
          </template>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <a :href="externalUrl" target="_blank" rel="noopener nofollow" class="btn btn-sm btn-ghost">去 Google</a>
          <button class="btn btn-ghost btn-sm btn-icon-sm" :disabled="loading" title="刷新结果" aria-label="刷新结果" @click="refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'animate-spin': loading }"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
          </button>
        </div>
      </div>

      <div v-if="loading" class="card overflow-hidden">
        <div v-for="n in 6" :key="n" class="border-b border-line px-4 py-4 last:border-0 sm:px-5">
          <div class="h-3.5 w-1/3 animate-pulse rounded bg-card2" />
          <div class="mt-2 h-3 w-4/5 animate-pulse rounded bg-card2" />
          <div class="mt-2 h-3 w-1/2 animate-pulse rounded bg-card2" />
        </div>
      </div>

      <div v-else-if="error" class="card p-8 text-center sm:p-10">
        <p class="text-[14px] font-semibold">{{ needsSetup ? 'Google 中转尚未配置' : '搜索失败' }}</p>
        <p class="mx-auto mt-1.5 max-w-[520px] text-[12.5px] leading-relaxed text-ink2">
          {{ needsSetup ? '管理员可在后台「引擎设置 → Google 搜索」添加中转线路，例如 SearXNG JSON 接口或 Google Custom Search API。' : errorMessage }}
        </p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <a :href="externalUrl" target="_blank" rel="noopener nofollow" class="btn btn-primary btn-sm">改用 Google 官方</a>
          <button class="btn btn-sm btn-ghost" @click="refresh">重新搜索</button>
        </div>
      </div>

      <div v-else-if="!items.length" class="card p-9 text-center">
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-card2 text-ink3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
        </span>
        <p class="mt-3 text-[14px] font-semibold">没有找到「{{ query }}」相关结果</p>
        <p class="mt-1 text-[12.5px] text-ink2">试试更短的关键词，或前往 Google 查看完整结果。</p>
        <a :href="externalUrl" target="_blank" rel="noopener nofollow" class="btn btn-primary btn-sm mt-4">去 Google 搜索</a>
      </div>

      <template v-else>
        <div class="card divide-y divide-line overflow-hidden">
          <article v-for="item in items" :key="item.url" class="px-4 py-3.5 sm:px-5">
            <a :href="item.url" target="_blank" rel="noopener nofollow" class="group block">
              <div class="flex items-start gap-3">
                <SiteIcon :src="iconOf(item.url)" :name="item.displayUrl" :url="item.url" class="mt-0.5 h-7 w-7 shrink-0 rounded-md" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[11.5px] text-ink3">{{ item.displayUrl }}</p>
                  <h2 class="mt-0.5 text-[15px] font-semibold leading-snug text-ink group-hover:underline">{{ item.title }}</h2>
                  <p v-if="item.snippet" class="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink2">{{ item.snippet }}</p>
                </div>
              </div>
            </a>
          </article>
        </div>

        <nav class="mt-4 flex items-center justify-center gap-2" aria-label="搜索结果分页">
          <button class="btn btn-sm btn-ghost" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
          <span class="text-[12px] tabular-nums text-ink2">第 {{ page }} 页</span>
          <button class="btn btn-sm btn-ghost" :disabled="!hasMore" @click="goPage(page + 1)">下一页</button>
        </nav>
      </template>
    </div>
  </div>
</template>
