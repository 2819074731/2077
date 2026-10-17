<script setup lang="ts">
import { computed } from 'vue'

interface SubmissionItem {
  id: number
  name: string
  url: string
  status: string
  target: string
  grp: string
  created_at: string
  reviewed_at?: string
  token?: string
}

interface StatusResponse {
  submission?: SubmissionItem
  items?: SubmissionItem[]
}

const route = useRoute()
const token = computed(() => String(route.query.token || '').trim())
const { settings, loadSiteSettings } = useSiteSettings()
await loadSiteSettings()

const { data, error, pending, refresh } = await useFetch<StatusResponse>(
  () => token.value ? `/api/submit/status?token=${encodeURIComponent(token.value)}` : '/api/submit/status',
  { watch: [token] }
)

const submission = computed(() => data.value?.submission || null)
const items = computed(() => data.value?.items || [])
const isNotFound = computed(() => error.value?.statusCode === 404)
const needLogin = computed(() => !token.value && !!error.value)
const errorMessage = computed(() => {
  const e = error.value as any
  return e?.data?.statusMessage || e?.statusMessage || '查询失败，请稍后重试'
})

useSeoMeta({
  title: () => `提交状态 · ${settings.value.siteName}`,
  description: '查询网站收录申请的审核进度。',
  robots: 'noindex,nofollow'
})

function statusText(status?: string | null) {
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已拒绝'
  if (status === 'pending') return '审核中'
  return '已提交'
}

function statusClass(status?: string | null) {
  if (status === 'approved') return 'text-success'
  if (status === 'rejected') return 'text-danger'
  if (status === 'pending') return 'text-warning'
  return 'text-ink2'
}

function statusNote(status?: string | null) {
  if (status === 'approved') return '该站点已通过审核，可以前往分类目录查看站点详情。'
  if (status === 'rejected') return '本次申请未通过审核，可以补充更完整的信息后再次提交。'
  return `申请已提交，通常会在 ${settings.value.submitReviewDays} 个工作日内完成审核，审核期间请勿重复提交。`
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-8 sm:py-12">
    <div class="mx-auto w-full max-w-[720px] animate-fade-up">
      <header class="mb-6 sm:mb-8">
        <h1 class="text-[24px] sm:text-[28px] leading-tight font-bold tracking-tight">提交状态</h1>
        <p class="mt-2 text-[13.5px] leading-6 text-ink2">查看网站收录申请的审核进度与历史记录。</p>
      </header>

      <div v-if="pending" class="card p-6 text-[13.5px] text-ink2" role="status" aria-live="polite">
        正在加载提交状态…
      </div>

      <section v-else-if="isNotFound" class="card p-6 sm:p-8 text-center" aria-labelledby="status-not-found-title">
        <h2 id="status-not-found-title" class="font-semibold text-lg">未找到提交记录</h2>
        <p class="text-[13px] leading-6 text-ink2 mt-2">查询链接可能不正确或已失效，请核对后重试。</p>
        <div class="flex flex-wrap justify-center gap-2 mt-5">
          <NuxtLink to="/submit" class="btn btn-primary">继续提交</NuxtLink>
          <NuxtLink to="/submit/status" class="btn">查看我的提交</NuxtLink>
          <NuxtLink to="/" class="btn">返回首页</NuxtLink>
        </div>
      </section>

      <section v-else-if="error" class="card p-6 sm:p-8 text-center" aria-labelledby="status-error-title">
        <h2 id="status-error-title" class="font-semibold text-lg">{{ needLogin ? '需要查询凭证' : '查询失败' }}</h2>
        <p class="text-[13px] leading-6 text-ink2 mt-2">
          {{ needLogin ? '请使用提交成功后的查询链接，或登录后查看最近的提交。' : errorMessage }}
        </p>
        <div class="flex flex-wrap justify-center gap-2 mt-5">
          <NuxtLink v-if="needLogin" to="/login?redirect=/submit/status" class="btn btn-primary">登录</NuxtLink>
          <button type="button" class="btn" @click="refresh()">重试</button>
          <NuxtLink to="/submit" class="btn">继续提交</NuxtLink>
          <NuxtLink to="/" class="btn">返回首页</NuxtLink>
        </div>
      </section>

      <section v-else-if="submission" class="card p-5 sm:p-7" aria-labelledby="submit-status-title">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 id="submit-status-title" class="font-semibold text-lg break-words">{{ submission.name }}</h2>
            <p class="text-[12px] text-ink3 mt-0.5">提交编号 #{{ submission.id }}</p>
          </div>
          <span class="chip shrink-0" :class="statusClass(submission.status)">{{ statusText(submission.status) }}</span>
        </div>

        <dl class="mt-5 grid gap-3.5 sm:grid-cols-2 text-[13px]">
          <div class="min-w-0">
            <dt class="text-[12px] text-ink3">网址</dt>
            <dd class="mt-0.5 break-all">
              <a
                :href="submission.url"
                target="_blank"
                rel="noopener"
                class="text-ink underline decoration-line2 underline-offset-4 hover:decoration-ink"
              >{{ submission.url }}</a>
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink3">分类</dt>
            <dd class="mt-0.5">{{ submission.grp || '由站长决定' }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink3">提交时间</dt>
            <dd class="mt-0.5">{{ formatDate(submission.created_at) }}</dd>
          </div>
          <div v-if="submission.reviewed_at">
            <dt class="text-[12px] text-ink3">审核时间</dt>
            <dd class="mt-0.5">{{ formatDate(submission.reviewed_at) }}</dd>
          </div>
        </dl>

        <div class="mt-4 rounded-xl border border-line bg-card2 px-3.5 py-3 text-[12.5px] leading-6 text-ink2">
          {{ statusNote(submission.status) }}
        </div>

        <div class="flex flex-wrap gap-2 mt-5">
          <NuxtLink to="/submit" class="btn btn-primary">继续提交</NuxtLink>
          <NuxtLink to="/" class="btn">返回首页</NuxtLink>
          <NuxtLink v-if="submission.status === 'approved'" to="/site" class="btn">浏览分类目录</NuxtLink>
        </div>
      </section>

      <section v-else-if="items.length" class="card p-5 sm:p-7" aria-labelledby="recent-submissions-title">
        <h2 id="recent-submissions-title" class="font-semibold text-lg">最近的提交</h2>
        <p class="text-[12.5px] text-ink2 mt-1">当前账号最近 20 条提交记录。</p>

        <ul class="mt-4 flex flex-col gap-2.5">
          <li v-for="item in items" :key="item.id" class="rounded-xl border border-line bg-card2 px-3.5 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[13.5px] font-medium truncate">{{ item.name }}</p>
                <p class="text-[11.5px] text-ink3 truncate mt-0.5">{{ item.url }}</p>
                <p class="text-[11.5px] text-ink3 mt-1">{{ formatDate(item.created_at) }} · {{ item.grp || '由站长决定' }}</p>
              </div>
              <div class="flex flex-col items-end gap-1.5 shrink-0">
                <span class="chip !text-[10px]" :class="statusClass(item.status)">{{ statusText(item.status) }}</span>
                <NuxtLink
                  v-if="item.token"
                  :to="`/submit/status?token=${item.token}`"
                  class="text-[12px] text-ink underline decoration-line2 underline-offset-4 hover:decoration-ink"
                >查看</NuxtLink>
              </div>
            </div>
          </li>
        </ul>

        <div class="flex flex-wrap gap-2 mt-5">
          <NuxtLink to="/submit" class="btn btn-primary">继续提交</NuxtLink>
          <NuxtLink to="/" class="btn">返回首页</NuxtLink>
        </div>
      </section>

      <section v-else class="card p-6 sm:p-8 text-center" aria-labelledby="no-submissions-title">
        <h2 id="no-submissions-title" class="font-semibold text-lg">还没有提交记录</h2>
        <p class="text-[13px] leading-6 text-ink2 mt-2">提交网站收录后，可以在这里查看审核进度。</p>
        <div class="flex flex-wrap justify-center gap-2 mt-5">
          <NuxtLink to="/submit" class="btn btn-primary">提交网站</NuxtLink>
          <NuxtLink to="/" class="btn">返回首页</NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
