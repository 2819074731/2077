<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Engine } from '~/data/nav'

const { allEngines, currentEngine, setEngine } = useNav()
const { isMobile } = useDevice()

const q = ref('')
const enginesOpen = ref(false)
const customOpen = ref(false)
const customName = ref('')
const customUrl = ref('')

const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const hotOpen = ref(false)
const hotItems = ref<string[]>([])
const hotLoading = ref(false)
const hotLive = ref(false)
const hotCache = new Map<string, { items: string[]; live: boolean; at: number }>()
const HOT_TTL = 5 * 60 * 1000
let hotSeq = 0
let closeTimer: ReturnType<typeof setTimeout> | null = null

const engine = computed(() => currentEngine())
const filteredHot = computed(() => {
  const text = q.value.trim().toLowerCase()
  if (!text) return hotItems.value
  return hotItems.value.filter(item => item.toLowerCase().includes(text)).slice(0, 8)
})

function cancelClose() {
  if (!closeTimer) return
  clearTimeout(closeTimer)
  closeTimer = null
}

function scheduleClose() {
  cancelClose()
  closeTimer = setTimeout(() => {
    hotOpen.value = false
  }, 120)
}

async function loadHot(id: string, force = false) {
  if (id === 'custom') {
    hotItems.value = []
    hotLive.value = false
    hotLoading.value = false
    return
  }
  const cached = hotCache.get(id)
  if (!force && cached && Date.now() - cached.at < HOT_TTL) {
    hotItems.value = cached.items
    hotLive.value = cached.live
    return
  }
  const seq = ++hotSeq
  hotLoading.value = true
  try {
    const res = await $fetch<{ items?: string[]; live?: boolean }>('/api/hot-search', { query: { engine: id } })
    if (seq !== hotSeq) return
    hotItems.value = Array.isArray(res.items) ? res.items : []
    hotLive.value = !!res.live
    if (hotItems.value.length) hotCache.set(id, { items: hotItems.value, live: hotLive.value, at: Date.now() })
  } catch {
    if (seq !== hotSeq) return
    const fallback = hotCache.get(id)
    hotItems.value = fallback?.items || []
    hotLive.value = false
  } finally {
    if (seq === hotSeq) hotLoading.value = false
  }
}

function openHot() {
  cancelClose()
  hotOpen.value = true
  loadHot(engine.value.id)
}

function pick(e: Engine) {
  setEngine(e.id)
  enginesOpen.value = false
  if (e.id === 'custom') {
    hotOpen.value = false
    return
  }
  hotOpen.value = true
  loadHot(e.id)
}

function pickHot(term: string) {
  q.value = term
  hotOpen.value = false
  go()
}

function onDocPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (target && rootRef.value?.contains(target)) return
  if (customOpen.value) return
  hotOpen.value = false
  enginesOpen.value = false
}

watch(() => engine.value.id, (id) => {
  hotItems.value = []
  hotLive.value = false
  if (id === 'custom') {
    hotOpen.value = false
    return
  }
  if (hotOpen.value) loadHot(id)
})

onMounted(() => {
  loadHot(engine.value.id)
  document.addEventListener('pointerdown', onDocPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  cancelClose()
})

function saveCustom() {
  const name = customName.value.trim()
  let url = customUrl.value.trim()
  if (!name || !url) return
  if (!/^https?:\/\//.test(url)) url = 'https://' + url
  if (!url.includes('%s')) {
    url = url.replace(/\/?$/, '') + (url.includes('?') ? '&q=%s' : '?q=%s')
  }
  setEngine('custom', { id: 'custom', name, url, custom: true })
  customName.value = ''
  customUrl.value = ''
  customOpen.value = false
  enginesOpen.value = false
  hotOpen.value = false
}

function go() {
  const text = q.value.trim()
  if (!text) return
  if (/^https?:\/\//.test(text)) { window.location.href = text; return }
  window.location.href = engine.value.url.replace('%s', encodeURIComponent(text))
}
</script>

<template>
  <div ref="rootRef" class="relative">
    <form
      class="relative flex items-center w-full h-[52px] rounded-2xl border border-line bg-card pl-2 pr-2 shadow-soft transition-all duration-200 focus-within:border-line2 focus-within:shadow-pop"
      @submit.prevent="go"
    >
      <div class="relative shrink-0">
        <button
          type="button"
          class="flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-[13px] font-medium text-ink2 hover:text-ink hover:bg-card2 transition-colors"
          :aria-expanded="enginesOpen"
          @click="enginesOpen = !enginesOpen"
          @blur="setTimeout(() => (enginesOpen = false), 120)"
        >
          <span>{{ engine.name }}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div
          v-if="enginesOpen"
          class="absolute z-50 top-full left-0 mt-2 w-44 card p-1.5 max-h-[60vh] overflow-y-auto animate-fade-up"
        >
          <button
            v-for="e in allEngines()"
            :key="e.id"
            type="button"
            class="flex w-full items-center h-8 px-2.5 rounded-lg text-[13px] text-left transition-colors"
            :class="e.id === engine.id ? 'bg-card2 text-ink font-medium' : 'text-ink2 hover:bg-card2 hover:text-ink'"
            @pointerdown.prevent="pick(e)"
          >
            {{ e.name }}
          </button>
          <button
            type="button"
            class="flex w-full items-center h-8 px-2.5 rounded-lg text-[13px] text-left text-ink2 hover:bg-card2 hover:text-ink"
            @pointerdown.prevent="customOpen = true; enginesOpen = false"
          >
            + 自定义
          </button>
        </div>
      </div>

      <span class="w-px h-6 bg-line mx-1.5 shrink-0" />

      <input
        ref="inputRef"
        v-model="q"
        type="text"
        enterkeyhint="search"
        class="flex-1 min-w-0 bg-transparent outline-none px-2 text-[15px] h-full"
        placeholder="搜索或输入网址，回车直达"
        autocomplete="off"
        spellcheck="false"
        aria-label="搜索或输入网址"
        :aria-expanded="hotOpen"
        @focus="openHot"
        @blur="scheduleClose"
        @keydown.enter.prevent="go"
        @keydown.esc="hotOpen = false"
      />

      <button
        type="submit"
        class="grid place-items-center w-9 h-9 shrink-0 rounded-xl bg-ink text-bg transition-transform hover:scale-105 active:scale-95"
        aria-label="搜索"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </button>
    </form>

    <div
      v-if="hotOpen && engine.id !== 'custom'"
      class="absolute left-0 right-0 top-[calc(100%+8px)] z-40 card p-2.5 shadow-pop animate-fade-up max-h-[70vh] overflow-y-auto"
      aria-label="热搜词"
    >
      <div class="flex items-center justify-between gap-3 px-1.5 pb-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-[12px] font-medium text-ink truncate">{{ engine.name }} 热搜</span>
          <span v-if="hotLive" class="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-md bg-card2 text-[10px] text-ink2 shrink-0">
            <span class="w-1 h-1 rounded-full bg-success" />
            实时
          </span>
        </div>
        <span v-if="hotLoading" class="text-[11px] text-ink3 shrink-0">更新中</span>
      </div>

      <div v-if="hotLoading && !hotItems.length" class="grid gap-0.5" :class="isMobile ? 'grid-cols-1' : 'grid-cols-2'">
        <div v-for="n in 6" :key="n" class="h-8 rounded-lg bg-card2 animate-pulse" />
      </div>

      <div v-else-if="filteredHot.length" class="grid gap-0.5" :class="isMobile ? 'grid-cols-1' : 'grid-cols-2'">
        <button
          v-for="(item, idx) in filteredHot"
          :key="item"
          type="button"
          class="group flex items-center gap-2 h-8 px-2 rounded-lg text-left text-[13px] text-ink2 hover:bg-card2 hover:text-ink transition-colors"
          :aria-label="`搜索 ${item}`"
          @pointerdown.prevent="pickHot(item)"
        >
          <span
            class="grid place-items-center w-4 h-4 shrink-0 rounded text-[10px] font-semibold"
            :class="idx < 3 ? 'bg-ink text-bg' : 'bg-card2 text-ink3'"
          >
            {{ idx + 1 }}
          </span>
          <span class="truncate">{{ item }}</span>
          <svg class="ml-auto shrink-0 opacity-0 group-hover:opacity-100 text-ink3" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M9 7h8v8" /></svg>
        </button>
      </div>

      <div v-else class="px-2 py-6 text-center text-[12.5px] text-ink2">
        <template v-if="q.trim()">没有匹配的热搜词，回车直接搜索「{{ q.trim() }}」</template>
        <template v-else>暂无热搜，直接输入关键词搜索</template>
      </div>
    </div>
  </div>

  <div v-if="customOpen" class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4" @click.self="customOpen = false">
    <div class="card w-full max-w-md p-6 animate-fade-up">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold m-0">自定义搜索引擎</h3>
        <button class="grid place-items-center w-7 h-7 rounded-lg text-ink2 hover:bg-card2 hover:text-ink" @click="customOpen = false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <p class="text-ink2 text-[13px] mb-4">填入搜索地址，用 <code class="px-1 rounded bg-card2">%s</code> 表示关键词位置。例如 <span class="text-ink">https://example.com/search?q=%s</span></p>
      <div class="flex flex-col gap-2.5">
        <input v-model="customName" class="field" placeholder="名称，如 站内搜索" />
        <input v-model="customUrl" class="field" placeholder="https://example.com/search?q=%s" @keyup.enter="saveCustom" />
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn" @click="customOpen = false">取消</button>
        <button class="btn btn-primary" @click="saveCustom">保存并设为默认</button>
      </div>
    </div>
  </div>
</template>
