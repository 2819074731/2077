<script setup lang="ts">
interface RepoDetail {
  id: number
  fullName: string
  owner: string
  name: string
  description: string
  stars: number
  forks: number
  issues: number
  watchers: number
  language: string
  license: string
  topics: string[]
  updatedAt: string
  pushedAt: string
  archived: boolean
  fork: boolean
  defaultBranch: string
  homepage: string
}

interface ReleaseAsset {
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
  assets: ReleaseAsset[]
}

interface TreeEntry {
  name: string
  path: string
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  size: number
  sha: string
}

interface FileContent {
  name: string
  path: string
  size: number
  sha: string
  kind: 'text' | 'image' | 'binary' | 'too-large'
  text: string
  truncated: boolean
  rawUrl: string
}

interface ContentsResult {
  type: 'dir' | 'file'
  path: string
  entries: TreeEntry[]
  file: FileContent | null
}

const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl

const owner = computed(() => String(route.params.owner || ''))
const repoName = computed(() => String(route.params.repo || ''))
const fullName = computed(() => `${owner.value}/${repoName.value}`)

function cleanPath(value: unknown): string {
  const raw = String(value ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!raw) return ''
  const parts = raw.split('/').filter(Boolean)
  if (parts.some(part => part === '.' || part === '..')) return ''
  return parts.slice(0, 60).join('/')
}

const path = computed(() => cleanPath(route.query.path))

const { data: repoData, pending: repoPending, error: repoError, refresh: refreshRepo } = await useAsyncData<{ repo: RepoDetail } | null>(
  () => `github-repo:${fullName.value}`,
  () => $fetch<{ repo: RepoDetail }>('/api/github/repo', { query: { repo: fullName.value } }),
  { server: false, watch: [fullName] }
)

const { data: contentsData, pending: contentsPending, error: contentsError, refresh: refreshContents } = await useAsyncData<ContentsResult | null>(
  () => `github-contents:${fullName.value}:${path.value}`,
  () => $fetch<ContentsResult>('/api/github/contents', {
    query: { repo: fullName.value, path: path.value }
  }),
  { server: false, watch: [fullName, path] }
)

const { data: releaseData, pending: releasePending, error: releaseError } = await useAsyncData<{ release: Release | null } | null>(
  () => `github-release:${fullName.value}`,
  () => $fetch<{ release: Release | null }>('/api/github/release', { query: { repo: fullName.value } }),
  { server: false, watch: [fullName] }
)

const repo = computed(() => repoData.value?.repo || null)
const contents = computed(() => contentsData.value)
const release = computed(() => releaseData.value?.release || null)
const repoLoading = computed(() => repoPending.value || (!repoData.value && !repoError.value))
const contentsLoading = computed(() => contentsPending.value || (!contentsData.value && !contentsError.value))
const releaseLoading = computed(() => releasePending.value || (!releaseData.value && !releaseError.value))

function errorText(value: any, fallback: string): string {
  return value?.data?.statusMessage || value?.statusMessage || fallback
}

const repoMessage = computed(() => errorText(repoError.value, '项目读取失败，请稍后重试'))
const contentsMessage = computed(() => errorText(contentsError.value, '目录读取失败，请稍后重试'))

const pathParts = computed(() => {
  if (!path.value) return []
  const parts = path.value.split('/')
  return parts.map((name, index) => ({ name, path: parts.slice(0, index + 1).join('/') }))
})

const parentPath = computed(() => {
  const parts = path.value.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
})

const isFile = computed(() => contents.value?.type === 'file')
const file = computed(() => contents.value?.file || null)
const lines = computed(() => (file.value?.text || '').split('\n'))
const shownLines = computed(() => lines.value.slice(0, 3000))

const zipHref = computed(() => `/api/github/download?repo=${encodeURIComponent(fullName.value)}&kind=zip`)

function assetHref(asset: ReleaseAsset): string {
  return `/api/github/download?repo=${encodeURIComponent(fullName.value)}&kind=asset&id=${asset.id}&name=${encodeURIComponent(asset.name)}`
}

function rawDownloadHref(item: FileContent): string {
  return `${item.rawUrl}&download=1`
}

function openPath(next: string) {
  router.push({
    path: `/github/${encodeURIComponent(owner.value)}/${encodeURIComponent(repoName.value)}`,
    query: next ? { path: next } : {}
  })
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
  if (size <= 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
}

useSeoMeta({
  title: () => repo.value ? `${repo.value.fullName} · GitHub` : 'GitHub 项目',
  description: () => repo.value?.description || '在站内浏览 GitHub 项目文件与版本下载。',
  ogTitle: () => repo.value ? `${repo.value.fullName} · GitHub` : 'GitHub 项目',
  ogDescription: () => repo.value?.description || '在站内浏览 GitHub 项目文件与版本下载。'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}/github/${encodeURIComponent(owner.value)}/${encodeURIComponent(repoName.value)}` }],
  meta: [{ name: 'robots', content: 'noindex, follow' }]
}))
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-6 sm:py-10">
    <NuxtLink to="/github" class="btn btn-ghost btn-sm mb-4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
      返回搜索
    </NuxtLink>

    <section class="card p-4 sm:p-7">
      <div v-if="repoLoading" class="animate-pulse space-y-3">
        <div class="h-7 w-2/3 rounded bg-card2" />
        <div class="h-4 w-full rounded bg-card2" />
        <div class="h-4 w-4/5 rounded bg-card2" />
      </div>

      <div v-else-if="repoError" class="py-6 text-center">
        <p class="text-[14px] font-medium">项目读取失败</p>
        <p class="mt-1 text-[12.5px] text-ink2">{{ repoMessage }}</p>
        <button class="btn btn-sm btn-primary mt-4" @click="refreshRepo()">重试</button>
      </div>

      <template v-else-if="repo">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap text-[12.5px] text-ink2">
              <NuxtLink to="/github" class="hover:text-ink">{{ repo.owner }}</NuxtLink>
              <span>/</span>
              <span class="text-ink">{{ repo.name }}</span>
              <span v-if="repo.archived" class="chip">已归档</span>
              <span v-if="repo.fork" class="chip">Fork</span>
            </div>
            <h1 class="mt-1 text-[22px] sm:text-[26px] font-bold tracking-tight leading-tight break-all">{{ repo.name }}</h1>
            <p v-if="repo.description" class="mt-2 text-[13px] leading-relaxed text-ink2 max-w-3xl">{{ repo.description }}</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <a :href="zipHref" class="btn btn-sm btn-primary">源码 ZIP</a>
            <a href="#downloads" class="btn btn-sm btn-ghost">版本下载</a>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-3 text-[12px] text-ink2 flex-wrap">
          <span class="inline-flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" /></svg>
            {{ formatNumber(repo.stars) }}
          </span>
          <span>Fork {{ formatNumber(repo.forks) }}</span>
          <span>Issue {{ formatNumber(repo.issues) }}</span>
          <span v-if="repo.language">{{ repo.language }}</span>
          <span v-if="repo.license">{{ repo.license }}</span>
          <span v-if="repo.defaultBranch">默认分支 {{ repo.defaultBranch }}</span>
          <span v-if="repo.updatedAt">更新于 {{ formatDate(repo.updatedAt) }}</span>
        </div>

        <div v-if="repo.topics.length" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="topic in repo.topics" :key="topic" class="chip">{{ topic }}</span>
        </div>
      </template>
    </section>

    <section class="card mt-4 overflow-hidden">
      <div class="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-line overflow-x-auto">
        <button type="button" class="text-[12.5px] text-ink2 hover:text-ink shrink-0" @click="openPath('')">{{ repoName }}</button>
        <template v-for="part in pathParts" :key="part.path">
          <span class="text-ink3 shrink-0">/</span>
          <button type="button" class="text-[12.5px] text-ink2 hover:text-ink shrink-0" @click="openPath(part.path)">{{ part.name }}</button>
        </template>
      </div>

      <div v-if="contentsLoading" class="p-4 sm:p-5 animate-pulse space-y-2">
        <div v-for="n in 6" :key="n" class="h-9 rounded-lg bg-card2" />
      </div>

      <div v-else-if="contentsError" class="p-8 text-center">
        <p class="text-[14px] font-medium">目录读取失败</p>
        <p class="mt-1 text-[12.5px] text-ink2">{{ contentsMessage }}</p>
        <button class="btn btn-sm btn-primary mt-4" @click="refreshContents()">重试</button>
      </div>

      <template v-else-if="contents">
        <div v-if="contents.type === 'dir'" class="p-2 sm:p-3">
          <div v-if="path" class="flex items-center gap-2 px-2 py-2 text-[12.5px]">
            <button type="button" class="inline-flex items-center gap-1 text-ink2 hover:text-ink" @click="openPath(parentPath)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
              上级目录
            </button>
          </div>

          <div v-if="!contents.entries.length" class="px-3 py-10 text-center text-[12.5px] text-ink2">空目录</div>

          <div v-else class="grid gap-0.5">
            <button
              v-for="entry in contents.entries"
              :key="entry.sha + entry.path"
              type="button"
              class="flex items-center gap-2.5 w-full min-h-10 px-2.5 rounded-lg text-left hover:bg-card2 transition-colors disabled:opacity-70"
              :disabled="entry.type === 'symlink' || entry.type === 'submodule'"
              @click="openPath(entry.path)"
            >
              <span class="grid place-items-center w-5 h-5 shrink-0" :class="entry.type === 'dir' ? 'text-accent' : 'text-ink3'">
                <svg v-if="entry.type === 'dir'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h6l2 2h10v11H3z" /></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>
              </span>
              <span class="min-w-0 flex-1 truncate text-[13px]">{{ entry.name }}</span>
              <span v-if="entry.type === 'symlink'" class="chip shrink-0">链接</span>
              <span v-else-if="entry.type === 'submodule'" class="chip shrink-0">子模块</span>
              <span v-else-if="entry.type === 'file'" class="text-[11.5px] text-ink3 shrink-0">{{ formatBytes(entry.size) }}</span>
            </button>
          </div>
        </div>

        <div v-else-if="contents.type === 'file' && file" class="p-3 sm:p-5">
          <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div class="min-w-0">
              <p class="text-[14px] font-medium break-all">{{ file.name }}</p>
              <p class="mt-0.5 text-[11.5px] text-ink3">{{ formatBytes(file.size) }}<span v-if="file.truncated"> · 内容已截断</span></p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-sm btn-ghost" @click="openPath(parentPath || '')">返回目录</button>
              <a :href="rawDownloadHref(file)" class="btn btn-sm btn-ghost">下载文件</a>
            </div>
          </div>

          <div v-if="file.kind === 'text'" class="rounded-xl border border-line bg-card2 overflow-hidden">
            <div class="overflow-auto max-h-[70vh]">
              <table class="min-w-full border-collapse font-mono text-[12px] leading-5">
                <tbody>
                  <tr v-for="(line, index) in shownLines" :key="index">
                    <td class="w-12 select-none border-r border-line px-2 text-right align-top text-ink3 tabular-nums">{{ index + 1 }}</td>
                    <td class="px-3 align-top whitespace-pre">{{ line || ' ' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="lines.length > shownLines.length" class="border-t border-line px-3 py-2 text-[11.5px] text-ink3">
              文件较大，仅显示前 {{ shownLines.length }} 行，可下载查看完整内容。
            </p>
          </div>

          <div v-else-if="file.kind === 'image'" class="rounded-xl border border-line bg-card2 p-3 sm:p-5 grid place-items-center">
            <img :src="file.rawUrl" :alt="file.name" class="max-w-full max-h-[70vh] rounded-lg object-contain">
          </div>

          <div v-else class="rounded-xl border border-line bg-card2 px-4 py-10 text-center">
            <p class="text-[13px] font-medium">{{ file.kind === 'too-large' ? '文件较大，暂不支持在线预览' : '该文件为二进制格式，暂不支持在线预览' }}</p>
            <p class="mt-1 text-[12px] text-ink2">可下载后使用本地工具打开。</p>
            <a :href="rawDownloadHref(file)" class="btn btn-sm btn-primary mt-4">下载文件</a>
          </div>
        </div>
      </template>
    </section>

    <section id="downloads" class="card p-4 sm:p-6 mt-4 scroll-mt-4">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-[15px] font-semibold">版本下载</h2>
          <p class="mt-1 text-[12px] text-ink2">默认分支源码与最新 Release 附件</p>
        </div>
        <a :href="zipHref" class="btn btn-sm btn-ghost">默认分支 ZIP</a>
      </div>

      <div v-if="releaseLoading" class="mt-4 h-16 rounded-xl bg-card2 animate-pulse" />
      <div v-else-if="releaseError" class="mt-4 text-[12.5px] text-ink2">Release 读取失败，仍可下载默认分支 ZIP。</div>
      <template v-else-if="release">
        <div class="mt-4 flex items-center gap-2 flex-wrap text-[12.5px] text-ink2">
          <span class="font-medium text-ink">{{ release.tag }}</span>
          <span v-if="release.publishedAt">{{ formatDate(release.publishedAt) }}</span>
        </div>
        <div v-if="release.assets.length" class="mt-3 grid gap-1.5">
          <a
            v-for="asset in release.assets"
            :key="asset.id"
            :href="assetHref(asset)"
            class="flex items-center justify-between gap-3 min-h-10 px-3 py-1.5 rounded-lg border border-line bg-card2 hover:border-line2 transition-colors"
          >
            <span class="min-w-0 truncate text-[12.5px]">{{ asset.name }}</span>
            <span class="text-[11px] text-ink3 shrink-0">{{ formatBytes(asset.size) }}</span>
          </a>
        </div>
        <p v-else class="mt-3 text-[12.5px] text-ink2">该 Release 没有附件，可下载上方源码 ZIP。</p>
      </template>
      <p v-else class="mt-4 text-[12.5px] text-ink2">该项目暂时没有 Release，可下载默认分支 ZIP。</p>
    </section>
  </div>
</template>
