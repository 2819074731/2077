<script setup lang="ts">
interface UserProfile {
  login: string
  name: string
  avatar: string
  bio: string
  company: string
  location: string
  blog: string
  twitter: string
  followers: number
  following: number
  publicRepos: number
  createdAt: string
}

interface UserRepo {
  id: number
  fullName: string
  owner: string
  name: string
  description: string
  stars: number
  forks: number
  language: string
  updatedAt: string
  archived: boolean
  fork: boolean
  topics: string[]
}

interface UserResult {
  user: UserProfile
  repos: UserRepo[]
  partial: boolean
}

const route = useRoute()
const siteUrl = useRuntimeConfig().public.siteUrl
const login = computed(() => String(route.params.login || ''))
const githubHref = computed(() => `https://github.com/${encodeURIComponent(login.value)}`)

const { data, pending, error, refresh } = await useAsyncData<UserResult | null>(
  () => `github-user:${login.value}`,
  () => login.value
    ? $fetch<UserResult>('/api/github/user', { query: { login: login.value } })
    : Promise.resolve(null),
  { server: false, watch: [login] }
)

const user = computed(() => data.value?.user || null)
const repos = computed(() => data.value?.repos || [])
const partial = computed(() => data.value?.partial || false)
const loading = computed(() => pending.value || (!data.value && !error.value))
const errorMessage = computed(() => {
  const data = error.value?.data as { statusMessage?: string } | undefined
  return data?.statusMessage || error.value?.statusMessage || '用户信息读取失败，请稍后重试'
})

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit' }).format(date)
}

function blogHref(value: string): string {
  const url = String(value || '').trim()
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

useSeoMeta({
  title: () => user.value ? `${user.value.name || user.value.login} · GitHub` : 'GitHub 用户',
  description: () => user.value?.bio || `查看 GitHub 用户 ${login.value} 的公开资料与仓库。`,
  robots: 'noindex, nofollow'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}/github/user/${encodeURIComponent(login.value)}` }],
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
}))
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-6 sm:py-10">
    <NuxtLink to="/github" class="btn btn-ghost btn-sm mb-4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
      返回搜索
    </NuxtLink>

    <div v-if="loading" class="card p-5 sm:p-7 animate-pulse">
      <div class="flex gap-4">
        <div class="w-20 h-20 rounded-full bg-card2 shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="h-6 w-1/2 rounded bg-card2" />
          <div class="h-4 w-1/3 rounded bg-card2" />
          <div class="h-4 w-full rounded bg-card2" />
        </div>
      </div>
    </div>

    <div v-else-if="error" class="card p-8 text-center">
      <p class="text-[14px] font-medium">用户信息读取失败</p>
      <p class="mt-1 text-[12.5px] text-ink2">{{ errorMessage }}</p>
      <button class="btn btn-sm btn-primary mt-4" @click="refresh()">重试</button>
    </div>

    <template v-else-if="user">
      <section class="card min-w-0 overflow-hidden p-4 sm:p-6">
        <div class="flex items-start gap-4 sm:gap-5">
          <img v-if="user.avatar" :src="user.avatar" :alt="user.login" width="80" height="80" loading="eager" decoding="async" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-card2 object-cover shrink-0">
          <span v-else class="grid place-items-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-card2 text-[22px] font-semibold shrink-0">{{ user.login.slice(0, 1).toUpperCase() }}</span>

          <div class="min-w-0 flex-1">
            <h1 class="text-[20px] sm:text-[24px] font-bold tracking-tight break-words [overflow-wrap:anywhere]">{{ user.name || user.login }}</h1>
            <p class="mt-0.5 text-[13px] text-ink2 truncate">@{{ user.login }}</p>
            <p v-if="user.bio" class="mt-2 text-[13px] leading-relaxed text-ink2 break-words [overflow-wrap:anywhere]">{{ user.bio }}</p>

            <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink2">
              <span v-if="user.company" class="inline-flex items-center gap-1 min-w-0 max-w-full">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg>
                <span class="truncate">{{ user.company }}</span>
              </span>
              <span v-if="user.location" class="inline-flex items-center gap-1 min-w-0 max-w-full">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
                <span class="truncate">{{ user.location }}</span>
              </span>
              <a v-if="user.blog" :href="blogHref(user.blog)" target="_blank" rel="noopener noreferrer nofollow" class="inline-flex items-center gap-1 min-w-0 max-w-full text-accent hover:underline">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1L11 5" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1-1" /></svg>
                <span class="truncate">{{ user.blog.replace(/^https?:\/\//i, '') }}</span>
              </a>
              <a v-if="user.twitter" :href="`https://x.com/${encodeURIComponent(user.twitter)}`" target="_blank" rel="noopener noreferrer nofollow" class="inline-flex items-center gap-1 min-w-0 max-w-full hover:text-ink">
                <span class="truncate">@{{ user.twitter }}</span>
              </a>
              <span v-if="user.createdAt">加入于 {{ formatDate(user.createdAt) }}</span>
            </div>

            <div class="mt-3 flex items-center gap-4 text-[12.5px] text-ink2 flex-wrap">
              <span><span class="font-semibold text-ink">{{ formatNumber(user.publicRepos) }}</span> 个仓库</span>
              <span><span class="font-semibold text-ink">{{ formatNumber(user.followers) }}</span> 关注者</span>
              <span><span class="font-semibold text-ink">{{ formatNumber(user.following) }}</span> 关注中</span>
              <a :href="githubHref" target="_blank" rel="noopener noreferrer nofollow" class="ml-auto text-[11.5px] text-ink3 hover:text-ink">在 GitHub 查看</a>
            </div>
          </div>
        </div>
      </section>

      <div class="mt-5 flex items-center gap-2">
        <h2 class="text-[15px] font-semibold">最近更新的仓库</h2>
        <span class="text-[12px] text-ink3">{{ repos.length }}</span>
      </div>

      <p v-if="partial" class="mt-1 text-[11.5px] text-ink3">部分仓库暂时读取失败，稍后刷新重试。</p>

      <div v-if="repos.length" class="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <NuxtLink
          v-for="repo in repos"
          :key="repo.id || repo.fullName"
          :to="`/github/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`"
          class="card min-w-0 overflow-hidden p-3.5 hover:border-line2 transition-colors"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="min-w-0 truncate text-[13.5px] font-semibold">{{ repo.name }}</span>
            <span class="chip shrink-0">Star {{ formatNumber(repo.stars) }}</span>
          </div>
          <p v-if="repo.description" class="mt-1.5 text-[12px] leading-relaxed text-ink2 line-clamp-2 break-words [overflow-wrap:anywhere]">{{ repo.description }}</p>
          <div class="mt-2 flex items-center gap-3 text-[11.5px] text-ink3 flex-wrap">
            <span v-if="repo.language">{{ repo.language }}</span>
            <span>Fork {{ formatNumber(repo.forks) }}</span>
            <span v-if="repo.updatedAt">更新于 {{ formatDate(repo.updatedAt) }}</span>
            <span v-if="repo.archived">已归档</span>
            <span v-else-if="repo.fork">Fork</span>
          </div>
        </NuxtLink>
      </div>
      <p v-else class="card mt-2.5 p-8 text-center text-[12.5px] text-ink2">暂无公开仓库。</p>
    </template>
  </div>
</template>
