<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { iconFor, hostOf } from '~/data/nav'

const props = defineProps<{ gid: string; link: { id: string; name: string; url: string; icon?: string }; featured?: boolean }>()
const { diy, updateLink, removeLink, recordClick, isBookmarked, toggleBookmark } = useNav()

const editing = ref(false)
const draft = ref({ name: '', url: '' })
const host = computed(() => hostOf(props.link.url))
const initial = computed(() => (props.link.name || '?').trim()[0]?.toUpperCase() || '?')

const src = computed(() => props.link.icon || iconFor(props.link.url))
const failed = ref(false)
watch(src, () => (failed.value = false))
const saved = computed(() => isBookmarked(props.link.url))

function toggleSave() {
  toggleBookmark({ url: props.link.url, name: props.link.name, icon: src.value })
}

function openEdit() {
  draft.value = { name: props.link.name, url: props.link.url }
  editing.value = true
}
function save() {
  if (!draft.value.name || !draft.value.url) return
  let url = draft.value.url
  if (!/^https?:\/\//.test(url)) url = 'https://' + url
  updateLink(props.gid, props.link.id, { name: draft.value.name, url })
  editing.value = false
}
</script>

<template>
  <div class="relative group">
    <a
      :href="link.url"
      target="_blank"
      rel="noopener"
      class="linkcard flex items-center gap-3 pl-3.5 pr-11 h-[58px] overflow-hidden"
      @click="!diy && recordClick(link.url, link.name)"
    >
      <span class="grid place-items-center w-9 h-9 rounded-xl bg-card2 border border-line shrink-0 overflow-hidden">
        <img
          v-if="src && !failed"
          :src="src"
          :alt="link.name"
          class="w-[18px] h-[18px] object-contain"
          loading="lazy"
          referrerpolicy="no-referrer"
          @error="failed = true"
        />
        <span v-else class="text-[14px] font-bold text-ink2">{{ initial }}</span>
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1">
          <span class="block text-[13.5px] font-medium leading-tight truncate">{{ link.name }}</span>
          <span v-if="featured" class="shrink-0 text-[10px] leading-none px-1 py-0.5 rounded bg-ink text-bg font-medium">荐</span>
        </span>
        <span class="block text-[11px] text-ink2 leading-tight truncate mt-0.5">{{ host }}</span>
      </span>
    </a>

    <button
      class="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-lg transition-all"
      :class="saved ? 'text-accent bg-accentsoft' : 'text-ink3 bg-transparent hover:bg-card2 hover:text-ink opacity-70 sm:opacity-0 sm:group-hover:opacity-100'"
      :title="saved ? '取消收藏' : '收藏'"
      :aria-label="saved ? '取消收藏' : '收藏'"
      @click.prevent.stop="toggleSave"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" :fill="saved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>
    </button>

    <div v-if="diy" class="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button class="grid place-items-center w-6 h-6 rounded-md bg-card border border-line text-ink2 hover:text-ink hover:border-line2" title="编辑" @click.prevent="openEdit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      </button>
      <button class="grid place-items-center w-6 h-6 rounded-md bg-card border border-line text-ink2 hover:text-ink hover:border-line2" title="删除" @click.prevent="removeLink(gid, link.id)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg>
      </button>
    </div>

    <div v-if="editing" class="absolute z-40 top-full left-0 mt-2 w-64 card p-3 flex flex-col gap-2 text-left animate-fade-up">
      <input v-model="draft.name" class="field" placeholder="名称" />
      <input v-model="draft.url" class="field" placeholder="网址" />
      <div class="flex gap-2 justify-end">
        <button class="btn btn-sm" @click.prevent="editing = false">取消</button>
        <button class="btn btn-sm btn-primary" @click.prevent="save">保存</button>
      </div>
    </div>
  </div>
</template>
