<script setup lang="ts">
import { computed, ref } from 'vue'

interface GithubRepoCardData {
  id: number
  fullName: string
  owner: string
  name: string
  description: string
  stars: number
  forks: number
  language: string
  license: string
  topics: string[]
  updatedAt: string
  archived: boolean
  fork: boolean
  avatar?: string
}

const props = defineProps<{ repo: GithubRepoCardData }>()

const avatarFailed = ref(false)
const detailPath = computed(() => `/github/${encodeURIComponent(props.repo.owner)}/${encodeURIComponent(props.repo.name)}`)
const sourceUrl = computed(() => `https://github.com/${encodeURIComponent(props.repo.owner)}/${encodeURIComponent(props.repo.name)}`)

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
    background: `linear-gradient(135deg, hsl(${hash} 52% 46%), hsl(${(hash + 42) % 360} 48% 38%))`
  }
}

function compactNumber(value: number): string {
  const n = Number(value || 0)
  if (n < 1000) return String(n)
  const k = n / 1000
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`
}

const relative = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })
const TIME_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000]
]

function timeAgo(value: string): string {
  const time = new Date(value).getTime()
  if (!time) return ''
  const diff = time - Date.now()
  if (Math.abs(diff) < 60 * 1000) return '刚刚'
  for (const [unit, ms] of TIME_UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit)
  }
  return ''
}
</script>

<template>
  <div class="group relative transition-colors hover:bg-card2">
    <NuxtLink
      :to="detailPath"
      class="flex gap-3 px-4 py-4 pr-14 sm:gap-3.5 sm:px-5 sm:pr-16"
      :aria-label="`${repo.owner} / ${repo.name}`"
    >
      <div class="shrink-0 pt-0.5">
        <img
          v-if="repo.avatar && !avatarFailed"
          :src="repo.avatar"
          :alt="repo.owner"
          class="h-9 w-9 rounded-lg border border-line bg-card2 object-cover sm:h-10 sm:w-10"
          loading="lazy"
          decoding="async"
          @error="avatarFailed = true"
        />
        <span
          v-else
          class="grid h-9 w-9 place-items-center rounded-lg text-[12px] font-bold text-white sm:h-10 sm:w-10"
          :style="avatarStyle(repo.owner)"
        >{{ initial(repo.owner) }}</span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <div class="flex min-w-0 items-baseline gap-1">
            <span class="max-w-[38%] shrink-0 truncate text-[11.5px] text-ink3 sm:max-w-[42%]">{{ repo.owner }} /</span>
            <span class="truncate text-[15px] font-semibold tracking-tight transition-colors group-hover:text-accent sm:text-[15.5px]">{{ repo.name }}</span>
          </div>
          <span class="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-ink2" :title="`${repo.stars.toLocaleString('zh-CN')} Stars`">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" /></svg>
            {{ compactNumber(repo.stars) }}
          </span>
        </div>

        <p v-if="repo.description" class="mt-1 line-clamp-2 text-[12.5px] leading-[1.65] text-ink2 sm:text-[13px]" :title="repo.description">
          {{ repo.description }}
        </p>
        <p v-else class="mt-1 text-[12.5px] italic text-ink3">暂无项目简介</p>

        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink3">
          <span v-if="repo.language" class="inline-flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-full" :style="{ background: languageColor(repo.language) }" />
            {{ repo.language }}
          </span>
          <span class="inline-flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M8 7.2h8M7 8l4 8M17 8l-4 8" /></svg>
            {{ compactNumber(repo.forks) }}
          </span>
          <span v-if="repo.license">{{ repo.license }}</span>
          <span v-if="repo.updatedAt">更新于 {{ timeAgo(repo.updatedAt) }}</span>
          <span v-if="repo.archived" class="rounded-full border border-line px-1.5 text-[10.5px]">已归档</span>
          <span v-if="repo.fork" class="rounded-full border border-line px-1.5 text-[10.5px]">Fork</span>
        </div>
      </div>
    </NuxtLink>

    <a
      :href="sourceUrl"
      target="_blank"
      rel="noopener noreferrer nofollow"
      class="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-ink3 transition-colors hover:bg-card2 hover:text-ink sm:right-4 sm:top-4"
      :title="`在 GitHub 打开 ${repo.owner}/${repo.name}`"
      :aria-label="`在 GitHub 打开 ${repo.owner}/${repo.name}`"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>
    </a>
  </div>
</template>
