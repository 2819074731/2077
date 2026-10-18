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

interface ReadmeResult {
  readme: {
    path: string
    branch: string
    truncated: boolean
    html: string
  } | null
}

interface IssueItem {
  number: number
  title: string
  state: string
  author: string
  avatar: string
  comments: number
  createdAt: string
  updatedAt: string
  labels: Array<{ name: string; color: string }>
  pullRequest: boolean
  body: string
}

interface CommitItem {
  sha: string
  shortSha: string
  message: string
  authorName: string
  authorLogin: string
  avatar: string
  date: string
  url: string
}

interface ContributorItem {
  login: string
  avatar: string
  contributions: number
  url: string
}

interface BranchItem { name: string; sha: string; protected: boolean }
interface TagItem { name: string; sha: string }

interface ReleaseAsset {
  id: number
  name: string
  size: number
  downloads: number
  contentType: string
}

interface ReleaseItem {
  id: number
  tag: string
  name: string
  body: string
  publishedAt: string
  prerelease: boolean
  draft: boolean
  author: string
  assets: ReleaseAsset[]
}

interface ExploreResult {
  issues: IssueItem[]
  pulls: IssueItem[]
  commits: CommitItem[]
  contributors: ContributorItem[]
  branches: BranchItem[]
  tags: TagItem[]
  releases: ReleaseItem[]
  partial: boolean
}

type TabValue = 'code' | 'issues' | 'pulls' | 'releases' | 'commits' | 'contributors' | 'branches' | 'tags'

const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl
const { settings, loadSiteSettings } = useSiteSettings()
await loadSiteSettings()

const gh = computed(() => settings.value.github)

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

const tabs = computed(() => {
  const list: Array<{ value: TabValue; label: string; count?: number }> = [
    { value: 'code', label: '代码' }
  ]
  if (gh.value.showIssues) list.push({ value: 'issues', label: 'Issues', count: repoData.value?.repo?.issues || 0 })
  if (gh.value.showPulls) list.push({ value: 'pulls', label: 'Pull requests' })
  if (gh.value.showReleases) list.push({ value: 'releases', label: 'Releases' })
  if (gh.value.showCommits) list.push({ value: 'commits', label: 'Commits' })
  if (gh.value.showRefs) {
    list.push({ value: 'branches', label: '分支' })
    list.push({ value: 'tags', label: '标签' })
  }
  if (gh.value.showContributors) list.push({ value: 'contributors', label: '贡献者' })
  return list
})

const activeTab = computed<TabValue>(() => {
  const raw = String(route.query.tab || 'code') as TabValue
  return tabs.value.some(tab => tab.value === raw) ? raw : 'code'
})

const { data: contentsData, pending: contentsPending, error: contentsError, refresh: refreshContents } = await useAsyncData<ContentsResult | null>(
  () => `github-contents:${fullName.value}:${path.value}:${activeTab.value}`,
  () => activeTab.value === 'code'
    ? $fetch<ContentsResult>('/api/github/contents', { query: { repo: fullName.value, path: path.value } })
    : Promise.resolve(null),
  { server: false, watch: [fullName, path, activeTab] }
)

const { data: readmeData, pending: readmePending, error: readmeError, refresh: refreshReadme } = await useAsyncData<ReadmeResult | null>(
  () => `github-readme:${fullName.value}:${activeTab.value}:${path.value}`,
  () => activeTab.value === 'code' && !path.value && gh.value.showReadme
    ? $fetch<ReadmeResult>('/api/github/readme', { query: { repo: fullName.value } })
    : Promise.resolve(null),
  { server: false, watch: [fullName, path, activeTab, () => gh.value.showReadme] }
)

const { data: exploreData, pending: explorePending, error: exploreError, refresh: refreshExplore } = await useAsyncData<ExploreResult | null>(
  () => `github-explore:${fullName.value}:${activeTab.value}`,
  () => activeTab.value === 'code'
    ? Promise.resolve(null)
    : $fetch<ExploreResult>('/api/github/explore', { query: { repo: fullName.value, type: activeTab.value } }),
  { server: false, watch: [fullName, activeTab] }
)

const repo = computed(() => repoData.value?.repo || null)
const contents = computed(() => contentsData.value)
const readme = computed(() => readmeData.value?.readme || null)
const explore = computed(() => exploreData.value)

const repoLoading = computed(() => repoPending.value || (!repoData.value && !repoError.value))
const contentsLoading = computed(() => activeTab.value === 'code' && (contentsPending.value || (!contentsData.value && !contentsError.value)))
const readmeLoading = computed(() => activeTab.value === 'code' && !path.value && gh.value.showReadme && (readmePending.value || (!readmeData.value && !readmeError.value)))

function errorText(value: any, fallback: string): string {
  return value?.data?.statusMessage || value?.statusMessage || fallback
}

const repoMessage = computed(() => errorText(repoError.value, '项目读取失败，请稍后重试'))
const contentsMessage = computed(() => errorText(contentsError.value, '目录读取失败，请稍后重试'))
const readmeMessage = computed(() => errorText(readmeError.value, 'README 读取失败'))
const exploreMessage = computed(() => errorText(exploreError.value, '内容读取失败，请稍后重试'))

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

const file = computed(() => contents.value?.file || null)
const lines = computed(() => (file.value?.text || '').split('\n'))
const shownLines = computed(() => lines.value.slice(0, 3000))

const zipHref = computed(() => `/api/github/download?repo=${encodeURIComponent(fullName.value)}&kind=zip`)
const githubHref = computed(() => `https://github.com/${owner.value}/${repoName.value}`)

function assetHref(asset: ReleaseAsset): string {
  return `/api/github/download?repo=${encodeURIComponent(fullName.value)}&kind=asset&id=${asset.id}&name=${encodeURIComponent(asset.name)}`
}

function rawDownloadHref(item: FileContent): string {
  return `${item.rawUrl}&download=1`
}

function setTab(value: TabValue) {
  router.push({
    path: route.path,
    query: value === 'code' ? {} : { tab: value }
  })
}

function openPath(next: string) {
  router.push({
    path: route.path,
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

function labelStyle(color: string): Record<string, string> {
  const hex = /^[0-9a-f]{6}$/i.test(color) ? color : '8b949e'
  return {
    borderColor: `#${hex}66`,
    backgroundColor: `#${hex}1f`
  }
}

function issueStateText(item: IssueItem): string {
  return item.state === 'closed' ? '已关闭' : '开放'
}

function releaseBody(value: string): string {
  return String(value || '').slice(0, 600)
}

useSeoMeta({
  title: () => repo.value ? `${repo.value.fullName} · GitHub` : 'GitHub 项目',
  description: () => repo.value?.description || '在站内浏览 GitHub 项目 README、Issues、提交与版本。',
  ogTitle: () => repo.value ? `${repo.value.fullName} · GitHub` : 'GitHub 项目',
  ogDescription: () => repo.value?.description || '在站内浏览 GitHub 项目 README、Issues、提交与版本。'
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
            <a v-if="gh.enableZip" :href="zipHref" class="btn btn-sm btn-primary">源码 ZIP</a>
            <a :href="githubHref" target="_blank" rel="noopener noreferrer nofollow" class="btn btn-sm btn-ghost">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>
              GitHub 源地址
            </a>
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

    <nav class="mt-4 flex items-center gap-1 overflow-x-auto border-b border-line" aria-label="项目内容">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] border-b-2 -mb-px shrink-0 transition-colors"
        :class="activeTab === tab.value ? 'border-ink text-ink font-medium' : 'border-transparent text-ink2 hover:text-ink'"
        @click="setTab(tab.value)"
      >
        {{ tab.label }}
        <span v-if="tab.count" class="chip !px-1.5 !py-0 text-[10.5px] tabular-nums">{{ formatNumber(tab.count) }}</span>
      </button>
    </nav>

    <template v-if="activeTab === 'code'">
      <section class="card mt-4 overflow-hidden">
        <div class="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-line overflow-x-auto">
          <button type="button" class="text-[12.5px] shrink-0" :class="path ? 'text-ink2 hover:text-ink' : 'text-ink font-medium'" @click="openPath('')">{{ repoName }}</button>
          <template v-for="part in pathParts" :key="part.path">
            <span class="text-ink3 shrink-0">/</span>
            <button type="button" class="text-[12.5px] text-ink2 hover:text-ink shrink-0" @click="openPath(part.path)">{{ part.name }}</button>
          </template>
          <span v-if="repo?.defaultBranch" class="ml-auto chip shrink-0">{{ repo.defaultBranch }}</span>
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

      <section v-if="!path && gh.showReadme" class="card mt-4 p-4 sm:p-6">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 min-w-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>
            <span class="text-[13px] font-medium truncate">{{ readme?.path || 'README' }}</span>
            <span v-if="readme?.truncated" class="chip">已截断</span>
          </div>
          <a :href="`${githubHref}#readme`" target="_blank" rel="noopener noreferrer nofollow" class="text-[11.5px] text-ink3 hover:text-ink">在 GitHub 查看</a>
        </div>

        <div v-if="readmeLoading" class="mt-4 animate-pulse space-y-2.5">
          <div class="h-5 w-2/5 rounded bg-card2" />
          <div class="h-3.5 w-full rounded bg-card2" />
          <div class="h-3.5 w-11/12 rounded bg-card2" />
          <div class="h-3.5 w-4/5 rounded bg-card2" />
        </div>
        <div v-else-if="readmeError" class="mt-4 text-[12.5px] text-ink2">
          {{ readmeMessage }}
          <button class="btn btn-sm btn-ghost ml-2" @click="refreshReadme()">重试</button>
        </div>
        <div v-else-if="readme" class="gh-readme mt-4" v-html="readme.html" />
        <p v-else class="mt-4 text-[12.5px] text-ink2">该项目没有 README 文件。</p>
      </section>
    </template>

    <section v-else class="card mt-4 p-4 sm:p-5">
      <div v-if="explorePending" class="animate-pulse space-y-2">
        <div v-for="n in 5" :key="n" class="h-12 rounded-lg bg-card2" />
      </div>

      <div v-else-if="exploreError" class="py-8 text-center">
        <p class="text-[14px] font-medium">内容读取失败</p>
        <p class="mt-1 text-[12.5px] text-ink2">{{ exploreMessage }}</p>
        <button class="btn btn-sm btn-primary mt-4" @click="refreshExplore()">重试</button>
      </div>

      <template v-else-if="explore">
        <p v-if="explore.partial" class="mb-3 text-[11.5px] text-ink3">部分内容暂时读取失败，稍后刷新重试。</p>

        <div v-if="activeTab === 'issues'" class="grid gap-1.5">
          <div v-if="!explore.issues.length" class="py-10 text-center text-[12.5px] text-ink2">暂无 Issues。</div>
          <article v-for="item in explore.issues" :key="item.number" class="rounded-xl border border-line bg-card2 p-3.5">
            <div class="flex items-start gap-2.5">
              <span class="mt-0.5 shrink-0" :class="item.state === 'closed' ? 'text-ink3' : 'text-accent'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
              </span>
              <div class="min-w-0 flex-1">
                <a :href="`${githubHref}/issues/${item.number}`" target="_blank" rel="noopener noreferrer nofollow" class="text-[13.5px] font-medium break-words hover:text-accent">{{ item.title }}</a>
                <div class="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink3 flex-wrap">
                  <span>#{{ item.number }}</span>
                  <span>{{ issueStateText(item) }}</span>
                  <span v-if="item.author">{{ item.author }}</span>
                  <span>{{ formatDate(item.updatedAt || item.createdAt) }}</span>
                  <span v-if="item.comments">{{ item.comments }} 条评论</span>
                </div>
                <p v-if="item.body" class="mt-2 text-[12px] leading-relaxed text-ink2 line-clamp-3 whitespace-pre-line">{{ item.body }}</p>
                <div v-if="item.labels.length" class="mt-2 flex flex-wrap gap-1.5">
                  <span v-for="label in item.labels" :key="label.name" class="chip !py-0 border" :style="labelStyle(label.color)">{{ label.name }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div v-else-if="activeTab === 'pulls'" class="grid gap-1.5">
          <div v-if="!explore.pulls.length" class="py-10 text-center text-[12.5px] text-ink2">暂无 Pull requests。</div>
          <article v-for="item in explore.pulls" :key="item.number" class="rounded-xl border border-line bg-card2 p-3.5">
            <div class="flex items-start gap-2.5">
              <span class="mt-0.5 shrink-0 text-accent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5V15a3 3 0 0 0 3 3h6.5M13 6h5v6" /></svg>
              </span>
              <div class="min-w-0 flex-1">
                <a :href="`${githubHref}/pull/${item.number}`" target="_blank" rel="noopener noreferrer nofollow" class="text-[13.5px] font-medium break-words hover:text-accent">{{ item.title }}</a>
                <div class="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink3 flex-wrap">
                  <span>#{{ item.number }}</span>
                  <span>{{ issueStateText(item) }}</span>
                  <span v-if="item.author">{{ item.author }}</span>
                  <span>{{ formatDate(item.updatedAt || item.createdAt) }}</span>
                  <span v-if="item.comments">{{ item.comments }} 条评论</span>
                </div>
                <p v-if="item.body" class="mt-2 text-[12px] leading-relaxed text-ink2 line-clamp-3 whitespace-pre-line">{{ item.body }}</p>
              </div>
            </div>
          </article>
        </div>

        <div v-else-if="activeTab === 'releases'" class="grid gap-3">
          <div v-if="!explore.releases.length" class="py-10 text-center text-[12.5px] text-ink2">暂无 Release。</div>
          <article v-for="item in explore.releases" :key="item.tag" class="rounded-xl border border-line bg-card2 p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[14px] font-semibold">{{ item.name }}</span>
                  <span class="chip">{{ item.tag }}</span>
                  <span v-if="item.prerelease" class="chip">预发布</span>
                </div>
                <p class="mt-1 text-[11.5px] text-ink3">{{ formatDate(item.publishedAt) }}<span v-if="item.author"> · {{ item.author }}</span></p>
              </div>
              <a :href="`${githubHref}/releases/tag/${encodeURIComponent(item.tag)}`" target="_blank" rel="noopener noreferrer nofollow" class="text-[11.5px] text-ink3 hover:text-ink">在 GitHub 查看</a>
            </div>
            <p v-if="item.body" class="mt-2 text-[12.5px] leading-relaxed text-ink2 line-clamp-4 whitespace-pre-line">{{ releaseBody(item.body) }}</p>
            <div v-if="item.assets.length && gh.enableReleaseDownload" class="mt-3 grid gap-1.5">
              <a
                v-for="asset in item.assets"
                :key="asset.id"
                :href="assetHref(asset)"
                class="flex items-center justify-between gap-3 min-h-10 px-3 py-1.5 rounded-lg border border-line bg-card hover:border-line2 transition-colors"
              >
                <span class="min-w-0 truncate text-[12.5px]">{{ asset.name }}</span>
                <span class="text-[11px] text-ink3 shrink-0">{{ formatBytes(asset.size) }}</span>
              </a>
            </div>
          </article>
        </div>

        <div v-else-if="activeTab === 'commits'" class="grid gap-1.5">
          <div v-if="!explore.commits.length" class="py-10 text-center text-[12.5px] text-ink2">暂无提交记录。</div>
          <a
            v-for="item in explore.commits"
            :key="item.sha"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer nofollow"
            class="flex items-center gap-3 rounded-xl border border-line bg-card2 p-3 hover:border-line2 transition-colors"
          >
            <span class="grid place-items-center w-8 h-8 rounded-lg bg-card text-ink3 shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" /><path d="M3 12h6M15 12h6" /></svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-medium truncate">{{ item.message }}</span>
              <span class="mt-0.5 block text-[11.5px] text-ink3">{{ item.authorLogin || item.authorName }} · {{ formatDate(item.date) }}</span>
            </span>
            <span class="font-mono text-[11px] text-ink3 shrink-0">{{ item.shortSha }}</span>
          </a>
        </div>

        <div v-else-if="activeTab === 'branches'" class="grid gap-1.5">
          <div v-if="!explore.branches.length" class="py-10 text-center text-[12.5px] text-ink2">暂无分支。</div>
          <div v-for="item in explore.branches" :key="item.name" class="flex items-center gap-3 rounded-xl border border-line bg-card2 px-3.5 py-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-ink3 shrink-0"><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8.5v7M8.5 6H14a4 4 0 0 1 4 4" /></svg>
            <span class="min-w-0 flex-1 truncate text-[13px]">{{ item.name }}</span>
            <span v-if="item.protected" class="chip">受保护</span>
            <span class="font-mono text-[11px] text-ink3">{{ item.sha.slice(0, 7) }}</span>
          </div>
        </div>

        <div v-else-if="activeTab === 'tags'" class="grid gap-1.5">
          <div v-if="!explore.tags.length" class="py-10 text-center text-[12.5px] text-ink2">暂无标签。</div>
          <div v-for="item in explore.tags" :key="item.name" class="flex items-center gap-3 rounded-xl border border-line bg-card2 px-3.5 py-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-ink3 shrink-0"><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" /><circle cx="8" cy="8" r="1.2" /></svg>
            <span class="min-w-0 flex-1 truncate text-[13px]">{{ item.name }}</span>
            <span class="font-mono text-[11px] text-ink3">{{ item.sha.slice(0, 7) }}</span>
          </div>
        </div>

        <div v-else-if="activeTab === 'contributors'" class="grid gap-1.5 sm:grid-cols-2">
          <div v-if="!explore.contributors.length" class="py-10 text-center text-[12.5px] text-ink2 sm:col-span-2">暂无贡献者数据。</div>
          <a
            v-for="item in explore.contributors"
            :key="item.login"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer nofollow"
            class="flex items-center gap-3 rounded-xl border border-line bg-card2 p-3 hover:border-line2 transition-colors"
          >
            <img v-if="item.avatar" :src="item.avatar" :alt="item.login" width="32" height="32" loading="lazy" decoding="async" class="w-8 h-8 rounded-full bg-card object-cover shrink-0">
            <span v-else class="grid place-items-center w-8 h-8 rounded-full bg-card text-[12px] font-semibold shrink-0">{{ item.login.slice(0, 1).toUpperCase() }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] font-medium truncate">{{ item.login }}</span>
              <span class="block text-[11.5px] text-ink3">{{ formatNumber(item.contributions) }} 次提交</span>
            </span>
          </a>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.gh-readme {
  color: var(--text);
  font-size: 14px;
  line-height: 1.72;
  overflow-wrap: break-word;
}
.gh-readme :deep(h1),
.gh-readme :deep(h2),
.gh-readme :deep(h3),
.gh-readme :deep(h4),
.gh-readme :deep(h5),
.gh-readme :deep(h6) {
  margin: 1.4em 0 0.6em;
  font-weight: 650;
  line-height: 1.3;
  scroll-margin-top: 1rem;
}
.gh-readme :deep(h1),
.gh-readme :deep(h2) {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border);
}
.gh-readme :deep(h1) { font-size: 1.7em; }
.gh-readme :deep(h2) { font-size: 1.4em; }
.gh-readme :deep(h3) { font-size: 1.2em; }
.gh-readme :deep(h4) { font-size: 1.05em; }
.gh-readme :deep(p),
.gh-readme :deep(ul),
.gh-readme :deep(ol),
.gh-readme :deep(blockquote),
.gh-readme :deep(table),
.gh-readme :deep(pre) {
  margin: 0.8em 0;
}
.gh-readme :deep(ul),
.gh-readme :deep(ol) {
  padding-left: 1.6em;
}
.gh-readme :deep(ul) { list-style: disc; }
.gh-readme :deep(ol) { list-style: decimal; }
.gh-readme :deep(li) { margin: 0.25em 0; }
.gh-readme :deep(li > ul),
.gh-readme :deep(li > ol) { margin: 0.25em 0; }
.gh-readme :deep(a) {
  color: var(--text);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.gh-readme :deep(a:hover) { color: var(--text-2); }
.gh-readme :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  background: var(--card-2);
}
.gh-readme :deep(hr) {
  height: 1px;
  margin: 1.5em 0;
  background: var(--border);
  border: 0;
}
.gh-readme :deep(blockquote) {
  padding: 0.2em 1em;
  color: var(--text-2);
  border-left: 3px solid var(--border-strong);
}
.gh-readme :deep(code) {
  padding: 0.15em 0.4em;
  font-size: 0.88em;
  background: var(--card-2);
  border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.gh-readme :deep(pre) {
  padding: 0.9em 1em;
  overflow: auto;
  background: var(--card-2);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.gh-readme :deep(pre code) {
  padding: 0;
  background: transparent;
  border-radius: 0;
}
.gh-readme :deep(table) {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
  border-collapse: collapse;
}
.gh-readme :deep(th),
.gh-readme :deep(td) {
  padding: 0.4em 0.75em;
  border: 1px solid var(--border);
}
.gh-readme :deep(th) { background: var(--card-2); font-weight: 600; }
.gh-readme :deep(details) {
  margin: 0.8em 0;
  padding: 0.6em 0.85em;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card-2);
}
.gh-readme :deep(summary) { cursor: pointer; font-weight: 550; }
.gh-readme :deep(input[type="checkbox"]) {
  width: 0.95em;
  height: 0.95em;
  margin-right: 0.35em;
  vertical-align: -0.1em;
  accent-color: var(--text-3);
}
.gh-readme :deep(kbd) {
  padding: 0.1em 0.4em;
  font-size: 0.82em;
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--card-2);
}
</style>
