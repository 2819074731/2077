<script setup lang="ts">
interface IssueDetail {
  number: number
  title: string
  state: string
  stateReason: string
  author: string
  avatar: string
  createdAt: string
  updatedAt: string
  closedAt: string
  comments: number
  labels: Array<{ name: string; color: string }>
  bodyHtml: string
  pullRequest: boolean
}

interface IssueComment {
  author: string
  avatar: string
  createdAt: string
  association: string
  bodyHtml: string
}

interface IssueThreadResult {
  issue: IssueDetail
  comments: IssueComment[]
  partial: boolean
}

interface RepoDetail {
  fullName: string
  owner: string
  name: string
}

const route = useRoute()
const siteUrl = useRuntimeConfig().public.siteUrl
const owner = computed(() => String(route.params.owner || ''))
const repoName = computed(() => String(route.params.repo || ''))
const number = computed(() => Number(route.params.number) || 0)
const fullName = computed(() => `${owner.value}/${repoName.value}`)
const repoHref = computed(() => `/github/${encodeURIComponent(owner.value)}/${encodeURIComponent(repoName.value)}`)
const githubHref = computed(() => `https://github.com/${fullName.value}/issues/${number.value}`)

const { data: repoData } = await useAsyncData<{ repo: RepoDetail } | null>(
  () => `github-issue-repo:${fullName.value}`,
  () => $fetch<{ repo: RepoDetail }>('/api/github/repo', { query: { repo: fullName.value } }),
  { server: false, watch: [fullName] }
)

const { data: threadData, pending, error, refresh } = await useAsyncData<IssueThreadResult | null>(
  () => `github-issue:${fullName.value}:${number.value}`,
  () => number.value
    ? $fetch<IssueThreadResult>('/api/github/issue', { query: { repo: fullName.value, number: number.value } })
    : Promise.resolve(null),
  { server: false, watch: [fullName, number] }
)

const issue = computed(() => threadData.value?.issue || null)
const comments = computed(() => threadData.value?.comments || [])
const partial = computed(() => threadData.value?.partial || false)
const loading = computed(() => pending.value || (!threadData.value && !error.value))
const errorMessage = computed(() => error.value?.data?.statusMessage || error.value?.statusMessage || 'Issue 读取失败，请稍后重试')
const repo = computed(() => repoData.value?.repo || null)

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function labelStyle(color: string): Record<string, string> {
  const hex = /^[0-9a-f]{6}$/i.test(color) ? color : '8b949e'
  return {
    borderColor: `#${hex}66`,
    backgroundColor: `#${hex}1f`
  }
}

function stateText(item: IssueDetail): string {
  if (item.pullRequest) return item.state === 'closed' ? '已关闭的 Pull Request' : 'Pull Request'
  if (item.state !== 'closed') return '开放中'
  if (item.stateReason === 'completed') return '已完成'
  if (item.stateReason === 'not_planned') return '未计划'
  return '已关闭'
}

function associationText(value: string): string {
  const map: Record<string, string> = {
    OWNER: '仓库所有者',
    MEMBER: '组织成员',
    COLLABORATOR: '协作者',
    CONTRIBUTOR: '贡献者',
    FIRST_TIME_CONTRIBUTOR: '首次贡献',
    NONE: ''
  }
  return map[value] || value
}

useSeoMeta({
  title: () => issue.value ? `${issue.value.title} · Issue #${issue.value.number}` : 'GitHub Issue',
  description: () => `在站内阅读 ${fullName.value} 的 Issue #${number.value}。`,
  robots: 'noindex, nofollow'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}${repoHref.value}/issues/${number.value}` }],
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
}))
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-6 sm:py-10">
    <NuxtLink :to="`${repoHref}?tab=issues`" class="btn btn-ghost btn-sm mb-4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
      返回 Issues
    </NuxtLink>

    <div v-if="loading" class="card p-5 sm:p-7 animate-pulse space-y-3">
      <div class="h-6 w-3/4 rounded bg-card2" />
      <div class="h-4 w-1/2 rounded bg-card2" />
      <div class="h-32 w-full rounded bg-card2" />
    </div>

    <div v-else-if="error" class="card p-8 text-center">
      <p class="text-[14px] font-medium">Issue 读取失败</p>
      <p class="mt-1 text-[12.5px] text-ink2">{{ errorMessage }}</p>
      <button class="btn btn-sm btn-primary mt-4" @click="refresh()">重试</button>
    </div>

    <template v-else-if="issue">
      <section class="card min-w-0 overflow-hidden p-4 sm:p-6">
        <div class="flex items-center gap-2 flex-wrap text-[12.5px] text-ink2">
          <NuxtLink :to="`/github/user/${encodeURIComponent(owner)}`" class="hover:text-ink">{{ owner }}</NuxtLink>
          <span>/</span>
          <NuxtLink :to="repoHref" class="hover:text-ink">{{ repoName }}</NuxtLink>
          <span>/</span>
          <span class="text-ink">Issue #{{ issue.number }}</span>
        </div>

        <h1 class="mt-2 text-[20px] sm:text-[25px] font-bold leading-snug tracking-tight break-words [overflow-wrap:anywhere]">{{ issue.title }}</h1>

        <div class="mt-3 flex items-center gap-2 text-[12.5px] flex-wrap">
          <span
            class="chip !h-7 shrink-0"
            :class="issue.state === 'closed' ? 'text-ink2' : '!border-transparent !bg-accentsoft !text-accent'"
          >{{ stateText(issue) }}</span>
          <NuxtLink v-if="issue.author" :to="`/github/user/${encodeURIComponent(issue.author)}`" class="inline-flex items-center gap-1.5 min-w-0 hover:text-ink">
            <img v-if="issue.avatar" :src="issue.avatar" :alt="issue.author" width="22" height="22" loading="lazy" decoding="async" class="w-[22px] h-[22px] rounded-full bg-card2 object-cover shrink-0">
            <span class="truncate">{{ issue.author }}</span>
          </NuxtLink>
          <span>创建于 {{ formatDate(issue.createdAt) }}</span>
          <span v-if="issue.comments">{{ formatNumber(issue.comments) }} 条评论</span>
          <a :href="githubHref" target="_blank" rel="noopener noreferrer nofollow" class="ml-auto text-[11.5px] text-ink3 hover:text-ink">在 GitHub 查看</a>
        </div>

        <div v-if="issue.labels.length" class="mt-3 flex flex-wrap gap-1.5 overflow-hidden">
          <span v-for="label in issue.labels" :key="label.name" class="chip !py-0 max-w-full truncate border" :style="labelStyle(label.color)">{{ label.name }}</span>
        </div>
      </section>

      <section class="card mt-4 min-w-0 overflow-hidden p-4 sm:p-6">
        <GithubMarkdown v-if="issue.bodyHtml" :html="issue.bodyHtml" />
        <p v-else class="py-8 text-center text-[12.5px] text-ink2">作者没有填写 Issue 描述。</p>
      </section>

      <p v-if="partial" class="mt-3 text-[11.5px] text-ink3">部分评论暂时读取失败，稍后刷新重试。</p>

      <section v-if="comments.length" class="mt-4">
        <h2 class="mb-2.5 text-[14px] font-semibold">评论 <span class="text-[12px] font-normal text-ink3">{{ comments.length }}</span></h2>
        <div class="grid gap-2.5">
          <article v-for="(comment, index) in comments" :key="`${comment.author}-${comment.createdAt}-${index}`" class="card min-w-0 overflow-hidden p-4">
            <div class="flex items-center gap-2 text-[12px] text-ink2 flex-wrap">
              <NuxtLink v-if="comment.author" :to="`/github/user/${encodeURIComponent(comment.author)}`" class="inline-flex items-center gap-1.5 min-w-0 hover:text-ink">
                <img v-if="comment.avatar" :src="comment.avatar" :alt="comment.author" width="20" height="20" loading="lazy" decoding="async" class="w-5 h-5 rounded-full bg-card2 object-cover shrink-0">
                <span class="truncate font-medium text-ink">{{ comment.author }}</span>
              </NuxtLink>
              <span v-if="associationText(comment.association)" class="chip !h-5 !text-[11px]">{{ associationText(comment.association) }}</span>
              <span class="text-ink3">{{ formatDate(comment.createdAt) }}</span>
            </div>
            <GithubMarkdown v-if="comment.bodyHtml" class="mt-2.5" :html="comment.bodyHtml" />
          </article>
        </div>
      </section>

      <p v-else-if="!partial" class="mt-4 text-center text-[12.5px] text-ink2">暂无评论。</p>
    </template>
  </div>
</template>
