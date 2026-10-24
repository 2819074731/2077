<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { Engine } from '~/data/nav'

const { allEngines, currentEngine, setEngine } = useNav()
const { isMobile } = useDevice()

const q = ref('')
const enginesOpen = ref(false)
const customOpen = ref(false)
const customName = ref('')
const customUrl = ref('')

const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const hotOpen = ref(false)
const hotItems = ref<string[]>([])
const hotLoading = ref(false)
const hotLive = ref(false)
const hotCache = new Map<string, { items: string[]; live: boolean; at: number }>()
const HOT_TTL = 5 * 60 * 1000
const RECENT_KEY = 'nav:recent-searches'
const RECENT_MAX = 5
const recent = ref<string[]>([])
const activeIndex = ref(-1)
const panelMax = ref(0)
let hotSeq = 0
let siteSeq = 0
let siteTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

const engine = computed(() => currentEngine())
const isSiteSearch = computed(() => engine.value.id === 'site')
const inputPlaceholder = computed(() => isSiteSearch.value ? '搜索目录站点、公开收藏，回车查看结果' : '搜索或输入网址，回车直达')
const panelTitle = computed(() => isSiteSearch.value
  ? (q.value.trim() ? '站内搜索建议' : '站内热门')
  : `${engine.value.name} 热搜`)
const filteredHot = computed(() => {
  if (isSiteSearch.value) return hotItems.value
  const text = q.value.trim().toLowerCase()
  if (!text) return hotItems.value
  return hotItems.value.filter(item => item.toLowerCase().includes(text)).slice(0, 8)
})
const recentCount = computed(() => (q.value.trim() ? 0 : recent.value.length))
const suggestions = computed(() => {
  if (q.value.trim()) return filteredHot.value.map(term => ({ term, source: 'hot' as const }))
  return [
    ...recent.value.map(term => ({ term, source: 'recent' as const })),
    ...hotItems.value.map(term => ({ term, source: 'hot' as const }))
  ]
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

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) {
      recent.value = parsed.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, RECENT_MAX)
    }
  } catch {}
}

function remember(term: string) {
  const text = term.trim()
  if (!text || /^https?:\/\//i.test(text)) return
  recent.value = [text, ...recent.value.filter(x => x !== text)].slice(0, RECENT_MAX)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value)) } catch {}
}

function clearRecent() {
  recent.value = []
  activeIndex.value = -1
  try { localStorage.removeItem(RECENT_KEY) } catch {}
}

function track(term: string, kind: 'hot' | 'input') {
  if (isSiteSearch.value) return
  const text = term.trim()
  if (!text) return
  const body = JSON.stringify({ engine: engine.value.id, term: text, kind })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/search/event', new Blob([body], { type: 'application/json' }))
      return
    }
  } catch {}
  fetch('/api/search/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {})
}

function updatePanelHeight() {
  if (!isMobile.value) { panelMax.value = 0; return }
  nextTick(() => {
    const vv = window.visualViewport
    const bottom = rootRef.value?.getBoundingClientRect().bottom ?? 0
    const available = Math.floor((vv?.height || window.innerHeight) - bottom - 16)
    panelMax.value = Math.max(96, Math.min(available, Math.floor((vv?.height || window.innerHeight) * 0.7)))
  })
}

function scrollActive() {
  nextTick(() => {
    const el = panelRef.value?.querySelector<HTMLElement>(`[data-idx="${activeIndex.value}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function moveActive(delta: number) {
  if (!hotOpen.value) openHot()
  const total = suggestions.value.length
  if (!total) return
  activeIndex.value = (activeIndex.value + delta + total) % total
  scrollActive()
}

function onEnter() {
  const picked = activeIndex.value >= 0 ? suggestions.value[activeIndex.value] : null
  if (picked) {
    pickHot(picked.term, picked.source === 'recent' ? 'input' : 'hot')
    return
  }
  go()
}

async function loadSiteSuggest() {
  const seq = ++siteSeq
  hotSeq++
  hotLoading.value = !hotItems.value.length
  try {
    const res = await $fetch<{ items?: string[] }>('/api/search/suggest', {
      query: { q: q.value.trim(), limit: 10 }
    })
    if (seq !== siteSeq) return
    hotItems.value = Array.isArray(res.items) ? res.items : []
    hotLive.value = true
  } catch {
    if (seq !== siteSeq) return
    hotItems.value = []
    hotLive.value = false
  } finally {
    if (seq === siteSeq) hotLoading.value = false
  }
}

async function loadHot(id: string, force = false) {
  if (id === 'site') {
    await loadSiteSuggest()
    return
  }
  if (id === 'custom') {
    hotItems.value = []
    hotLive.value = false
    hotLoading.value = false
    return
  }
  siteSeq++
  const cached = hotCache.get(id)
  if (cached) {
    hotItems.value = cached.items
    hotLive.value = cached.live
    if (!force && Date.now() - cached.at < HOT_TTL) return
  }
  const seq = ++hotSeq
  hotLoading.value = !hotItems.value.length
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
  enginesOpen.value = false
  hotOpen.value = true
  activeIndex.value = -1
  updatePanelHeight()
  loadHot(engine.value.id)
}

function prefetchHot(id: string) {
  if (id === 'site') {
    if (!hotItems.value.length) loadSiteSuggest()
    return
  }
  if (id === 'custom' || hotCache.has(id)) return
  $fetch<{ items?: string[]; live?: boolean }>('/api/hot-search', { query: { engine: id } })
    .then((res) => {
      const items = Array.isArray(res.items) ? res.items : []
      if (items.length) hotCache.set(id, { items, live: !!res.live, at: Date.now() })
    })
    .catch(() => {})
}

function warmHot() {
  if (hotOpen.value) return
  const run = () => loadHot(engine.value.id)
  if ('requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(run, { timeout: 2500 })
  } else {
    setTimeout(run, 1200)
  }
}

function toggleEngines() {
  enginesOpen.value = !enginesOpen.value
  if (enginesOpen.value) {
    cancelClose()
    hotOpen.value = false
  }
}

function pick(e: Engine) {
  setEngine(e.id)
  enginesOpen.value = false
  cancelClose()
  hotOpen.value = false
  if (e.id !== 'custom') loadHot(e.id)
}

function pickHot(term: string, kind: 'hot' | 'input' = 'hot') {
  q.value = term
  hotOpen.value = false
  go(kind)
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
  activeIndex.value = -1
  if (id === 'custom') {
    hotOpen.value = false
    return
  }
  if (hotOpen.value) loadHot(id)
})

watch(q, () => {
  activeIndex.value = -1
  if (!isSiteSearch.value || !hotOpen.value) return
  if (siteTimer) clearTimeout(siteTimer)
  siteTimer = setTimeout(() => { void loadSiteSuggest() }, 180)
})

watch(hotOpen, (open) => {
  if (open) updatePanelHeight()
})

onMounted(() => {
  loadRecent()
  warmHot()
  document.addEventListener('pointerdown', onDocPointerDown)
  window.addEventListener('resize', updatePanelHeight)
  window.visualViewport?.addEventListener('resize', updatePanelHeight)
  window.visualViewport?.addEventListener('scroll', updatePanelHeight)
})

onBeforeUnmount(() => {
  if (siteTimer) clearTimeout(siteTimer)
  document.removeEventListener('pointerdown', onDocPointerDown)
  window.removeEventListener('resize', updatePanelHeight)
  window.visualViewport?.removeEventListener('resize', updatePanelHeight)
  window.visualViewport?.removeEventListener('scroll', updatePanelHeight)
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

function go(kind: 'hot' | 'input' = 'input') {
  const text = q.value.trim()
  if (!text) return
  if (/^https?:\/\//.test(text)) { window.location.href = text; return }
  remember(text)
  if (!isSiteSearch.value) track(text, kind)
  const target = engine.value.url.replace('%s', encodeURIComponent(text))
  if (target.startsWith('/')) {
    navigateTo(target)
    return
  }
  window.location.href = target
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
          @click="toggleEngines"
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
            @pointerenter="prefetchHot(e.id)"
            @focus="prefetchHot(e.id)"
            @click.stop="pick(e)"
          >
            {{ e.name }}
          </button>
          <button
            type="button"
            class="flex w-full items-center h-8 px-2.5 rounded-lg text-[13px] text-left text-ink2 hover:bg-card2 hover:text-ink"
            @click.stop="customOpen = true; enginesOpen = false"
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
        :placeholder="inputPlaceholder"
        autocomplete="off"
        spellcheck="false"
        :aria-label="inputPlaceholder"
        :aria-expanded="hotOpen"
        aria-controls="search-suggestions"
        @focus="openHot"
        @blur="scheduleClose"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="hotOpen = false; activeIndex = -1"
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
      id="search-suggestions"
      ref="panelRef"
      class="absolute left-0 right-0 top-[calc(100%+8px)] z-40 card p-2.5 shadow-pop animate-fade-up max-h-[70vh] overflow-y-auto overscroll-contain"
      :style="isMobile && panelMax ? { maxHeight: panelMax + 'px' } : undefined"
      aria-label="搜索建议"
    >
      <div class="flex items-center justify-between gap-3 px-1.5 pb-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-[12px] font-medium text-ink truncate">{{ panelTitle }}</span>
          <span v-if="hotLive" class="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-md bg-card2 text-[10px] text-ink2 shrink-0">
            <span class="w-1 h-1 rounded-full bg-success" />
            实时
          </span>
        </div>
        <span v-if="hotLoading" class="text-[11px] text-ink3 shrink-0">更新中</span>
      </div>

      <div v-if="!q.trim() && recent.length" class="mb-2">
        <div class="flex items-center justify-between gap-3 px-1.5 pb-1.5">
          <span class="text-[11.5px] text-ink3">最近搜索</span>
          <button
            type="button"
            class="text-[11px] text-ink3 hover:text-ink"
            @click="clearRecent"
          >清除</button>
        </div>
        <div class="grid gap-0.5" :class="isMobile ? 'grid-cols-1' : 'grid-cols-2'">
          <button
            v-for="(item, idx) in recent"
            :key="'recent-' + item"
            type="button"
            :data-idx="idx"
            class="group flex items-center gap-2 h-8 px-2 rounded-lg text-left text-[13px] transition-colors"
            :class="activeIndex === idx ? 'bg-card2 text-ink' : 'text-ink2 hover:bg-card2 hover:text-ink'"
            :aria-label="`再次搜索 ${item}`"
            @click="pickHot(item, 'input')"
          >
            <svg class="shrink-0 text-ink3" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <span class="truncate">{{ item }}</span>
          </button>
        </div>
      </div>

      <div v-if="hotLoading && !hotItems.length" class="grid gap-0.5" :class="isMobile ? 'grid-cols-1' : 'grid-cols-2'">
        <div v-for="n in 6" :key="n" class="h-8 rounded-lg bg-card2 animate-pulse" />
      </div>

      <div v-else-if="filteredHot.length" class="grid gap-0.5" :class="isMobile ? 'grid-cols-1' : 'grid-cols-2'">
        <button
          v-for="(item, idx) in filteredHot"
          :key="item"
          type="button"
          :data-idx="recentCount + idx"
          class="group flex items-center gap-2 h-8 px-2 rounded-lg text-left text-[13px] transition-colors"
          :class="activeIndex === recentCount + idx ? 'bg-card2 text-ink' : 'text-ink2 hover:bg-card2 hover:text-ink'"
          :aria-label="`搜索 ${item}`"
          @click="pickHot(item)"
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

      <div v-else-if="!q.trim() && recent.length" class="hidden" />

      <div v-else class="px-2 py-6 text-center text-[12.5px] text-ink2">
        <template v-if="q.trim()">没有匹配的{{ isSiteSearch ? '站内内容' : '热搜词' }}，回车{{ isSiteSearch ? '查看完整搜索' : '直接搜索' }}「{{ q.trim() }}」</template>
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
