<script setup lang="ts">
import { ref, watch } from 'vue'

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
  sortOptions: SearchSortOption[]
  loading?: boolean
  error?: string
  total?: number
  countSuffix?: string
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
const sortDraft = ref(props.sort)

watch(() => props.query, (value) => { input.value = value })
watch(() => props.sort, (value) => { sortDraft.value = value })

function submit() {
  const text = input.value.replace(/\s+/g, ' ').trim()
  if (!text) return
  emit('submit', text)
}

function changeSort() {
  emit('sort', sortDraft.value)
}

function goPage(value: number) {
  if (value < 1 || value > props.pageCount) return
  emit('page', value)
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-6 sm:py-10">
    <NuxtLink to="/" class="btn btn-ghost btn-sm mb-4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
      返回首页
    </NuxtLink>

    <section class="card p-4 sm:p-7">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="flex items-start gap-3 min-w-0">
          <span v-if="$slots.icon" class="grid place-items-center w-9 h-9 rounded-xl bg-ink text-bg shrink-0">
            <slot name="icon" />
          </span>
          <div class="min-w-0">
            <h1 class="text-[22px] sm:text-[26px] font-bold tracking-tight leading-tight">{{ title }}</h1>
            <p v-if="description" class="text-[12px] text-ink2 mt-1 leading-relaxed">{{ description }}</p>
          </div>
        </div>
        <span v-if="badge" class="chip">{{ badge }}</span>
      </div>

      <form class="mt-5 flex flex-col sm:flex-row gap-2" @submit.prevent="submit">
        <input
          v-model="input"
          class="field flex-1 !h-11 sm:!h-[42px]"
          :placeholder="placeholder"
          autocomplete="off"
          spellcheck="false"
          :aria-label="placeholder"
        />
        <select v-model="sortDraft" class="field sm:w-36 !h-11 sm:!h-[42px]" aria-label="排序方式" @change="changeSort">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <button type="submit" class="btn btn-primary !h-11 sm:!h-[42px] px-5">搜索</button>
      </form>

      <div v-if="!query && suggestions.length" class="mt-4 flex items-center gap-2 flex-wrap text-[12.5px] text-ink2">
        <span>试试：</span>
        <button
          v-for="term in suggestions"
          :key="term"
          type="button"
          class="chip hover:border-line2 hover:text-ink transition-colors"
          @click="emit('suggestion', term)"
        >{{ term }}</button>
      </div>
    </section>

    <slot v-if="!query" name="intro" />

    <section v-else class="mt-4">
      <div class="flex items-center justify-between gap-3 mb-3 min-h-8">
        <p class="text-[12.5px] text-ink2 min-w-0">
          <template v-if="loading">正在搜索「{{ query }}」…</template>
          <template v-else-if="error">搜索未完成</template>
          <template v-else>
            约 {{ formatNumber(total) }} {{ countSuffix }}
            <span v-if="incomplete" class="text-ink3">（结果可能不完整）</span>
          </template>
        </p>
        <button class="btn btn-ghost btn-sm" :disabled="loading" @click="emit('refresh')">刷新</button>
      </div>

      <div v-if="loading" class="grid gap-3">
        <slot name="loading">
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
        </slot>
      </div>

      <div v-else-if="error" class="card p-8 text-center">
        <p class="text-[14px] font-medium">搜索失败</p>
        <p class="mt-1 text-[12.5px] text-ink2">{{ error }}</p>
        <button class="btn btn-sm btn-primary mt-4" @click="emit('refresh')">重试</button>
      </div>

      <div v-else-if="!total" class="card p-8 text-center">
        <p class="text-[14px] font-medium">{{ emptyTitle }}</p>
        <p class="mt-1 text-[12.5px] text-ink2">{{ emptyHint }}</p>
      </div>

      <div v-else class="grid gap-3">
        <slot />
      </div>

      <div v-if="!loading && !error && pageCount > 1" class="mt-5 flex items-center justify-center gap-2">
        <button class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
        <span class="text-[12.5px] text-ink2 tabular-nums">第 {{ page }} / {{ pageCount }} 页</span>
        <button class="btn btn-ghost btn-sm" :disabled="page >= pageCount" @click="goPage(page + 1)">下一页</button>
      </div>
    </section>
  </div>
</template>
