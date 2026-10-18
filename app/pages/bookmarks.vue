<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { hostOf, iconFor } from '~/data/nav'
import type { Bookmark } from '~/composables/useNav'

const { bookmarks, addBookmark, updateBookmark, removeBookmark, bookmarkTags, loadLocal, syncMsg } = useNav()
const { user, refresh } = useAuth()
const { settings, loadSiteSettings } = useSiteSettings()
await loadSiteSettings()

useSeoMeta({ title: () => `我的收藏 · ${settings.value.siteName}`, robots: 'noindex' })

onMounted(async () => {
  loadLocal()
  await refresh()
  loadLocal()
})

const q = ref('')
const tag = ref('')
const tags = computed(() => bookmarkTags())
const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase()
  return bookmarks.value
    .filter((item) => {
      if (tag.value && item.tag !== tag.value) return false
      if (!kw) return true
      return `${item.name} ${item.url} ${item.note || ''} ${item.tag || ''}`.toLowerCase().includes(kw)
    })
    .sort((a, b) => b.createdAt - a.createdAt)
})

const formOpen = ref(false)
const editId = ref('')
const form = ref({ name: '', url: '', tag: '', note: '' })
const formError = ref('')
const formBusy = ref(false)

function openAdd() {
  editId.value = ''
  form.value = { name: '', url: '', tag: tag.value || '', note: '' }
  formError.value = ''
  formOpen.value = true
}

function openEdit(item: Bookmark) {
  editId.value = item.id
  form.value = { name: item.name, url: item.url, tag: item.tag || '', note: item.note || '' }
  formError.value = ''
  formOpen.value = true
}

function closeForm() {
  if (formBusy.value) return
  formOpen.value = false
}

function save() {
  const input = {
    name: form.value.name.trim(),
    url: form.value.url.trim(),
    tag: form.value.tag.trim(),
    note: form.value.note.trim()
  }
  if (!input.url) {
    formError.value = '请填写网址'
    return
  }
  formBusy.value = true
  const result = editId.value
    ? updateBookmark(editId.value, input)
    : addBookmark(input)
  formBusy.value = false
  if (!result.ok) {
    formError.value = result.reason || '保存失败'
    return
  }
  if (!editId.value && input.tag) tag.value = input.tag
  formOpen.value = false
}

const armedId = ref('')
let armedTimer: any = null
function armDelete(id: string) {
  armedId.value = id
  clearTimeout(armedTimer)
  armedTimer = setTimeout(() => (armedId.value = ''), 3200)
}
function doDelete(id: string) {
  removeBookmark(id)
  armedId.value = ''
  clearTimeout(armedTimer)
}
onBeforeUnmount(() => clearTimeout(armedTimer))

const fileInput = ref<HTMLInputElement | null>(null)
const importMsg = ref('')
let importTimer: any = null
function exportFavorites() {
  const data = JSON.stringify(bookmarks.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `2077-bookmarks-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
async function importFavorites(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importMsg.value = ''
  try {
    const list = JSON.parse(await file.text())
    if (!Array.isArray(list)) throw new Error('格式错误')
    let added = 0
    for (const raw of list.slice(0, 500)) {
      if (!raw || typeof raw !== 'object') continue
      const result = addBookmark({
        name: String(raw.name || ''),
        url: String(raw.url || ''),
        icon: String(raw.icon || ''),
        tag: String(raw.tag || ''),
        note: String(raw.note || '')
      })
      if (result.ok) added++
    }
    importMsg.value = `已导入 ${added} 条`
  } catch {
    importMsg.value = '导入失败，请检查 JSON 文件'
  } finally {
    input.value = ''
    clearTimeout(importTimer)
    importTimer = setTimeout(() => (importMsg.value = ''), 3200)
  }
}
onBeforeUnmount(() => clearTimeout(importTimer))
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-5 sm:py-8">
    <header class="flex items-start gap-3 mb-4">
      <div class="min-w-0">
        <h1 class="text-[24px] sm:text-[28px] font-extrabold tracking-tight leading-tight flex items-center gap-2">
          我的收藏
          <span class="chip !text-[11px]">{{ bookmarks.length }}</span>
        </h1>
        <p class="text-[12px] text-ink3 mt-1">
          {{ user ? '已登录，收藏会自动同步到云端。' : '未登录时保存在本机，登录后可同步到云端。' }}
          <span v-if="syncMsg" class="ml-1 text-ink2">{{ syncMsg }}</span>
        </p>
      </div>
      <div class="flex-1" />
      <button class="btn btn-sm btn-primary shrink-0" @click="openAdd">新建收藏</button>
    </header>

    <div class="flex flex-col gap-2.5 mb-4">
      <div class="flex gap-2">
        <div class="relative grow min-w-0">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input v-model="q" class="field pl-9" placeholder="搜索名称、网址、备注或标签" />
        </div>
        <button class="btn btn-sm shrink-0" title="导出 JSON" @click="exportFavorites">导出</button>
        <button class="btn btn-sm shrink-0" title="导入 JSON" @click="fileInput?.click()">导入</button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importFavorites" />
      </div>

      <div v-if="tags.length" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
        <button
          class="shrink-0 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors"
          :class="!tag ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="tag = ''"
        >全部</button>
        <button
          v-for="t in tags"
          :key="t"
          class="shrink-0 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors"
          :class="tag === t ? 'bg-ink text-bg border-transparent' : 'bg-card border-line text-ink2 hover:text-ink'"
          @click="tag = tag === t ? '' : t"
        >{{ t }}</button>
      </div>
      <p v-if="importMsg" class="text-[12px] text-accent">{{ importMsg }}</p>
    </div>

    <div v-if="!bookmarks.length" class="card p-8 sm:p-12 text-center">
      <span class="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-card2 text-ink3 mb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>
      </span>
      <p class="text-[15px] font-semibold">收藏夹还是空的</p>
      <p class="text-[12.5px] text-ink2 mt-1">在首页或分类目录点击卡片右侧的星标，就能把常用网址收进来。</p>
      <div class="flex items-center justify-center gap-2 mt-4">
        <NuxtLink to="/" class="btn btn-sm btn-primary">去首页逛逛</NuxtLink>
        <button class="btn btn-sm" @click="openAdd">手动添加</button>
      </div>
    </div>

    <div v-else-if="!filtered.length" class="card p-10 text-center text-ink2 text-[13px]">
      没有匹配的收藏。
      <button class="btn btn-sm btn-ghost ml-2" @click="q = ''; tag = ''">清除筛选</button>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      <article v-for="item in filtered" :key="item.id" class="card group p-3.5 flex flex-col gap-2.5 hover:border-ink/25 transition-colors">
        <div class="flex items-start gap-2.5">
          <SiteIcon :src="item.icon || iconFor(item.url)" :name="item.name" :url="item.url" class="w-10 h-10 rounded-xl shrink-0 text-[13px]" />
          <div class="min-w-0 flex-1">
            <a :href="item.url" target="_blank" rel="noopener" class="block text-[13.5px] font-semibold leading-tight truncate hover:text-accent transition-colors">{{ item.name }}</a>
            <a :href="item.url" target="_blank" rel="noopener" class="block text-[11px] text-ink3 leading-tight truncate mt-1 hover:text-ink2">{{ hostOf(item.url) }}</a>
          </div>
          <span v-if="item.tag" class="chip !text-[10px] shrink-0">{{ item.tag }}</span>
        </div>

        <p v-if="item.note" class="text-[12px] text-ink2 leading-5 line-clamp-2">{{ item.note }}</p>

        <div class="flex items-center gap-1.5 mt-auto pt-0.5">
          <a :href="item.url" target="_blank" rel="noopener" class="btn btn-sm btn-primary h-7">打开</a>
          <button class="btn btn-sm h-7" @click="openEdit(item)">编辑</button>
          <div class="flex-1" />
          <button v-if="armedId !== item.id" class="btn btn-sm btn-ghost h-7 text-ink2" @click="armDelete(item.id)">删除</button>
          <button v-else class="btn btn-sm h-7 !text-[11px] !bg-red-500 !text-white !border-transparent" @click="doDelete(item.id)">确认删除</button>
        </div>
      </article>
    </div>

    <p class="text-[12px] text-ink3 mt-5">
      支持从其他设备导入：先在那边导出 JSON，再在这里点击「导入」。
    </p>

    <div v-if="formOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="absolute inset-0 bg-black/45 backdrop-blur-sm" @click="closeForm" />
      <form class="relative w-full sm:max-w-[460px] bg-bg border border-line rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-3" @submit.prevent="save">
        <div class="flex items-center gap-2">
          <h2 class="text-[15px] font-semibold">{{ editId ? '编辑收藏' : '新建收藏' }}</h2>
          <div class="flex-1" />
          <button type="button" class="grid place-items-center w-7 h-7 rounded-lg text-ink2 hover:bg-card2" aria-label="关闭" @click="closeForm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <label class="flex flex-col gap-1 text-[12px] text-ink2">
          名称
          <input v-model="form.name" class="field" placeholder="例如：GitHub" autocomplete="off" />
        </label>
        <label class="flex flex-col gap-1 text-[12px] text-ink2">
          网址
          <input v-model="form.url" class="field" placeholder="https://example.com" autocomplete="off" @keyup.enter="save" />
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-[12px] text-ink2">
            标签
            <input v-model="form.tag" class="field" list="bookmark-tags" placeholder="可选" autocomplete="off" />
            <datalist id="bookmark-tags">
              <option v-for="t in tags" :key="t" :value="t" />
            </datalist>
          </label>
          <label class="flex flex-col gap-1 text-[12px] text-ink2">
            备注
            <input v-model="form.note" class="field" placeholder="可选" autocomplete="off" />
          </label>
        </div>
        <p v-if="formError" class="text-[12px] text-red-500">{{ formError }}</p>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="btn btn-sm" @click="closeForm">取消</button>
          <button type="submit" class="btn btn-sm btn-primary">保存</button>
        </div>
      </form>
    </div>
  </div>
</template>
