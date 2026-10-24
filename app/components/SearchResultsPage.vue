<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface SearchSortOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  title: string
  description?: string
  badge?: string
  placeholder?: string
  query: string
  sort: string
  sortOptions: readonly SearchSortOption[]
  loading?: boolean
  error?: string
  total?: number
  countSuffix?: string
  took?: number
  incomplete?: boolean
  emptyTitle?: string
  emptyHint?: string
  suggestions?: string[]
  page?: number
  pageCount?: number
}>(), {
  description: '',
  badge: '',
  placeholder: '输入关键词搜索',
  loading: false,
  error: '',
  total: 0,
  countSuffix: '条结果',
  took: 0,
  incomplete: false,
  emptyTitle: '没有找到相关内容',
  emptyHint: '换一个关键词再试。',
  suggestions: () => [],
  page: 1,
  pageCount: 1
})

const emit = defineEmits<{
  submit: [query: string]
  sort: [value: string]
  refresh: []
  page: [value: number]
  suggestion: [value: string]
}>()

const input = ref(props.query)
watch(() => props.query, (value) => { input.value = value })

function submit() {
  const text = input.value.replace(/\s+/g, ' ').trim()
  if (!text) return
  emit('submit', text)
}

function changeSort(value: string) {
  if (value === props.sort) return
  emit('sort', value)
}

function goPage(value: number) {
  if (value < 1 || value > props.pageCount) return
  emit('page', value)
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

const pageNumbers = computed<Array<number | '...'>>(() => {
  const current = props.page
  const count = props.pageCount
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)
  const pages = new Set<number>([1, count, current - 1, current, current + 1])
  if (current <= 3) [2, 3, 4].forEach(value => pages.add(value))
  if (current >= count - 2) [count - 3, count - 2, count - 1].forEach(value => pages.add(value))
  const sorted = [...pages].filter(value => value >= 1 && value <= count).sort((a, b) => a - b)
  const result: Array<number | '...'> = []
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push('...')
    result.push(value)
  })
  return result
})
</script>

<template>
  <div class="mx-auto max-w-wrap px-4 pb-12 pt-4 sm:pt-6">
    <div class="mb-4 flex items-center justify-between gap-3">
      <NuxtLink to="/" class="inline-flex items-center gap-1.5 text-[12.5px] text-ink2 transition-colors hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        返回首页
      </NuxtLink>
      <span v-if="badge" class="chip !h-6 !text-[11px]">{{ badge }}</span>
    </div>

    <header>
      <div class="flex items-center gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-bg">
          <slot name="icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          </slot>
        </span>
        <div class="min-w-0">
          <h1 class="text-[19px] font-bold tracking-tight sm:text-[23px]">{{ title }}</h1>
          <p v-if="description" class="mt-0.5 text-[12px] leading-relaxed text-ink2 sm:text-[12.5px]">{{ description }}</p>
        </div>
      </div>

      <form class="mt-4" @submit.prevent="submit">
        <div class="flex gap-2">
          <label class="relative min-w-0 flex-1">
            <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            <input
              v-model="input"
              class="field !h-12 !rounded-xl pl-10 pr-10 text-[14.5px]"
              :placeholder="placeholder"
              autocomplete="off"
              spellcheck="false"
              enterkeyhint="search"
              :aria-label="placeholder"
            />
            <button
              v-if="input"
              type="button"
              class="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ink3 hover:bg-card2 hover:text-ink"
              aria-label="清空搜索"
              @click="input = ''"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </label>
          <button type="submit" class="btn btn-primary !h-12 shrink-0 px-5 sm:px-6">搜索</button>
        </div>
      </form>

      <div class="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <span class="shrink-0 text-[11.5px] text-ink3">排序</span>
        <button
          v-for="option in sortOptions"
          :key="option.value"
          type="button"
          class="h-7 shrink-0 rounded-full px-2.5 text-[12px] font-medium transition-colors"
          :class="sort === option.value ? 'bg-ink text-bg' : 'text-ink2 hover:bg-card2 hover:text-ink'"
          :disabled="!query"
          @click="changeSort(option.value)"
        >{{ option.label }}</button>
        <template v-if="!query">
          <span class="mx-1 h-3 w-px shrink-0 bg-line" />
          <button
            v-for="term in suggestions.slice(0, 4)"
            :key="term"
            type="button"
            class="h-7 shrink-0 rounded-full border border-line px-2.5 text-[12px] text-ink2 transition-colors hover:border-line2 hover:text-ink"
            @click="emit('suggestion', term)"
          >{{ term }}</button>
        </template>
      </div>
    </header>

    <slot v-if="!query" name="intro" />

    <div v-else class="mt-5">
      <div class="mb-2.5 flex min-h-8 items-center justify-between gap-3">
        <div class="min-w-0 text-[12.5px] text-ink2">
          <template v-if="loading">
            正在搜索「<span class="text-ink">{{ query }}</span>」…
          </template>
          <template v-else-if="error">
            搜索未完成
          </template>
          <template v-else>
            找到 <span class="font-semibold text-ink">{{ formatNumber(total) }}</span> {{ countSuffix }}
            <span v-if="took" class="text-ink3">· {{ took }} ms</span>
            <span v-if="incomplete" class="text-ink3">（结果可能不完整）</span>
          </template>
        </div>
        <button class="btn btn-ghost btn-sm btn-icon-sm shrink-0" :disabled="loading" title="刷新结果" aria-label="刷新结果" @click="emit('refresh')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'animate-spin': loading }"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
        </button>
      </div>

      <slot name="filters" />

      <div v-if="loading" class="card overflow-hidden">
        <div v-for="n in 6" :key="n" class="flex animate-pulse gap-3 border-b border-line px-4 py-4 last:border-0 sm:px-5">
          <div class="h-9 w-9 shrink-0 rounded-lg bg-card2 sm:h-10 sm:w-10" />
          <div class="min-w-0 flex-1 space-y-2">
            <div class="h-3.5 w-1/3 rounded bg-card2" />
            <div class="h-3 w-4/5 rounded bg-card2" />
            <div class="h-3 w-1/2 rounded bg-card2" />
          </div>
        </div>
      </div>

      <div v-else-if="error" class="card p-9 text-center">
        <p class="text-[14px] font-semibold">搜索失败</p>
        <p class="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{{ error }}</p>
        <button class="btn btn-primary btn-sm mt-4" @click="emit('refresh')">重新搜索</button>
      </div>

      <div v-else-if="!total" class="card p-9 text-center">
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-card2 text-ink3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
        </span>
        <p class="mt-3 text-[14px] font-semibold">{{ emptyTitle }}</p>
        <p class="mt-1 text-[12.5px] text-ink2">{{ emptyHint }}</p>
        <div v-if="suggestions.length" class="mt-4 flex flex-wrap justify-center gap-2">
          <button v-for="term in suggestions.slice(0, 4)" :key="term" type="button" class="chip hover:text-ink" @click="emit('suggestion', term)">{{ term }}</button>
        </div>
      </div>

      <template v-else>
        <div class="card divide-y divide-line overflow-hidden">
          <slot />
        </div>

        <nav v-if="pageCount > 1" class="mt-4 flex items-center justify-between gap-2 sm:justify-center" aria-label="搜索结果分页">
          <button class="btn btn-sm btn-ghost" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
          <div class="hidden items-center gap-1 sm:flex">
            <template v-for="(item, index) in pageNumbers" :key="`${item}-${index}`">
              <span v-if="item === '...'" class="grid h-8 w-6 place-items-center text-[12px] text-ink3">…</span>
              <button
                v-else
                class="h-8 min-w-8 rounded-lg px-2 text-[12.5px] font-medium transition-colors"
                :class="item === page ? 'bg-ink text-bg' : 'text-ink2 hover:bg-card2 hover:text-ink'"
                :aria-current="item === page ? 'page' : undefined"
                @click="goPage(item)"
              >{{ item }}</button>
            </template>
          </div>
          <span class="text-[12px] tabular-nums text-ink2 sm:hidden">{{ page }} / {{ pageCount }}</span>
          <button class="btn btn-sm btn-ghost" :disabled="page >= pageCount" @click="goPage(page + 1)">下一页</button>
        </nav>
      </template>
    </div>
  </div>
</template>
