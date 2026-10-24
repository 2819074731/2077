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
const showTitle = computed(() => !!props.item.title && props.item.title !== props.item.name)
</script>

<template>
  <NuxtLink
    :to="href"
    :target="internal ? undefined : '_blank'"
    :rel="internal ? undefined : 'noopener'"
    class="card group flex gap-3.5 p-4 sm:p-5 transition-all hover:border-line2 hover:shadow-pop"
    :aria-label="`${typeLabel}：${item.name}`"
    @click="emit('open')"
  >
    <span class="grid place-items-center w-11 h-11 rounded-xl bg-card2 border border-line shrink-0 overflow-hidden">
      <img
        v-if="icon && !failed"
        :src="icon"
        :alt="item.name"
        class="w-5 h-5 object-contain"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="failed = true"
      />
      <span v-else class="text-[15px] font-bold text-ink2">{{ initial }}</span>
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2 flex-wrap">
        <span class="text-[15px] font-semibold leading-snug break-words" v-html="highlightHtml(item.name, query)" />
        <span class="shrink-0 rounded-md bg-card2 px-1.5 py-0.5 text-[10.5px] text-ink3">{{ typeLabel }}</span>
        <span v-if="item.featured" class="shrink-0 rounded-md bg-ink px-1.5 py-0.5 text-[10.5px] font-medium text-bg">荐</span>
      </span>
      <span
        v-if="showTitle"
        class="mt-1 block text-[12.5px] leading-relaxed text-ink2 line-clamp-1"
        v-html="highlightHtml(item.title, query)"
      />
      <span
        class="mt-1 block text-[12.5px] leading-relaxed text-ink2 line-clamp-2 break-words [overflow-wrap:anywhere]"
        v-html="highlightHtml(description, query)"
      />
      <span class="mt-2 flex items-center gap-1.5 flex-wrap text-[11.5px] text-ink3">
        <span class="truncate max-w-[220px]">{{ host }}</span>
        <template v-if="item.category">
          <span>·</span>
          <span>{{ item.category }}</span>
        </template>
        <template v-if="item.owner">
          <span>·</span>
          <span>{{ item.owner.nickname }}</span>
        </template>
      </span>
    </span>

    <span class="mt-1 grid place-items-center w-7 h-7 shrink-0 rounded-lg text-ink3 transition-colors group-hover:bg-card2 group-hover:text-ink">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </span>
  </NuxtLink>
</template>
