<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { highlightHtml } from '#shared/search'

interface SearchItem {
  type: 'directory' | 'link'
  id: number
  name: string
  url: string
  icon: string
  title: string
  description: string
  category: string
  featured: boolean
  detailEnabled: boolean
  owner: { id: number; nickname: string } | null
  updatedAt: string
}

const props = defineProps<{ item: SearchItem; query: string }>()
const emit = defineEmits<{ open: [] }>()

const failed = ref(false)
const icon = computed(() => props.item.icon)
watch(icon, () => { failed.value = false })

const internal = computed(() => props.item.type === 'directory' && props.item.detailEnabled)
const href = computed(() => internal.value ? `/site/${props.item.id}.html` : props.item.url)
const host = computed(() => {
  try { return new URL(props.item.url).hostname.replace(/^www\./i, '') } catch { return props.item.url }
})
const initial = computed(() => (props.item.name || '?').trim()[0]?.toUpperCase() || '?')
const typeLabel = computed(() => props.item.type === 'directory' ? '目录' : '收藏')
const description = computed(() => {
  if (props.item.description) return props.item.description
  if (props.item.type === 'link') {
    return props.item.owner?.nickname ? `来自 ${props.item.owner.nickname} 的公开收藏` : '用户公开收藏的站点'
  }
  return props.item.category ? `收录于「${props.item.category}」分类` : '收录在 2077 导航目录中的站点'
})
</script>

<template>
  <NuxtLink
    :to="href"
    :target="internal ? undefined : '_blank'"
    :rel="internal ? undefined : 'noopener'"
    class="group flex gap-3 px-4 py-3.5 transition-colors hover:bg-card2 sm:gap-3.5 sm:px-5"
    :aria-label="`${typeLabel}：${item.name}`"
    @click="emit('open')"
  >
    <span class="shrink-0 pt-0.5">
      <span class="grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-line bg-card2 sm:h-10 sm:w-10">
        <img
          v-if="icon && !failed"
          :src="icon"
          :alt="item.name"
          class="h-5 w-5 object-contain"
          loading="lazy"
          referrerpolicy="no-referrer"
          @error="failed = true"
        />
        <span v-else class="text-[13px] font-bold text-ink2">{{ initial }}</span>
      </span>
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex items-start justify-between gap-2">
        <span
          class="min-w-0 truncate text-[15px] font-semibold tracking-tight transition-colors group-hover:text-accent sm:text-[15.5px]"
          v-html="highlightHtml(item.name, query)"
        />
        <span class="inline-flex shrink-0 items-center gap-1">
          <span v-if="item.featured" class="rounded-md bg-ink px-1.5 py-0.5 text-[10.5px] font-medium text-bg">荐</span>
          <span class="rounded-md bg-card2 px-1.5 py-0.5 text-[10.5px] text-ink3">{{ typeLabel }}</span>
        </span>
      </span>

      <span
        class="mt-1 line-clamp-2 break-words text-[12.5px] leading-[1.65] text-ink2 sm:text-[13px] [overflow-wrap:anywhere]"
        v-html="highlightHtml(description, query)"
      />

      <span class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink3">
        <span class="max-w-[220px] truncate">{{ host }}</span>
        <span v-if="item.category" class="truncate">{{ item.category }}</span>
        <span v-if="item.owner" class="truncate">{{ item.owner.nickname }}</span>
      </span>
    </span>

    <span class="mt-1 hidden shrink-0 place-items-center self-center rounded-lg text-ink3 transition-colors group-hover:bg-card2 group-hover:text-ink sm:grid sm:h-7 sm:w-7">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </span>
  </NuxtLink>
</template>
