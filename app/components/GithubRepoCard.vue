<script setup lang="ts">
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
}

const props = defineProps<{ repo: GithubRepoCardData }>()

const detailPath = computed(() => `/github/${encodeURIComponent(props.repo.owner)}/${encodeURIComponent(props.repo.name)}`)

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

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
</script>

<template>
  <article class="card min-w-0 p-4 sm:p-5">
    <div class="flex gap-3 sm:gap-4">
      <div class="grid place-items-center w-10 h-10 rounded-xl text-white text-[13px] font-bold shrink-0" :style="avatarStyle(repo.owner)">
        {{ initial(repo.owner) }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[12.5px] text-ink2">{{ repo.owner }} /</span>
          <NuxtLink :to="detailPath" class="text-[15px] font-semibold break-all hover:text-accent transition-colors">{{ repo.name }}</NuxtLink>
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
          <NuxtLink :to="detailPath" class="btn btn-sm btn-primary">
            查看项目
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>
          </NuxtLink>
          <span class="text-[11.5px] text-ink3">浏览文件与版本下载</span>
        </div>
      </div>
    </div>
  </article>
</template>
