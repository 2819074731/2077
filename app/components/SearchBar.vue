<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Engine } from '~/data/nav'

const { allEngines, currentEngine, setEngine } = useNav()

const q = ref('')
const enginesOpen = ref(false)
const customOpen = ref(false)
const customName = ref('')
const customUrl = ref('')

const engine = computed(() => currentEngine())

function pick(e: Engine) {
  setEngine(e.id)
  enginesOpen.value = false
}

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
}

function go() {
  const text = q.value.trim()
  if (!text) return
  if (/^https?:\/\//.test(text)) { window.location.href = text; return }
  window.location.href = engine.value.url.replace('%s', encodeURIComponent(text))
}
</script>

<template>
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
        class="absolute z-30 top-full left-0 mt-2 w-44 card p-1.5 max-h-[60vh] overflow-y-auto animate-fade-up"
      >
        <button
          v-for="e in allEngines()"
          :key="e.id"
          type="button"
          class="flex w-full items-center h-8 px-2.5 rounded-lg text-[13px] text-left transition-colors"
          :class="e.id === engine.id ? 'bg-card2 text-ink font-medium' : 'text-ink2 hover:bg-card2 hover:text-ink'"
          @mousedown.prevent="pick(e)"
        >
          {{ e.name }}
        </button>
        <button
          type="button"
          class="flex w-full items-center h-8 px-2.5 rounded-lg text-[13px] text-left text-ink2 hover:bg-card2 hover:text-ink"
          @mousedown.prevent="customOpen = true; enginesOpen = false"
        >
          + 自定义
        </button>
      </div>
    </div>

    <span class="w-px h-6 bg-line mx-1.5 shrink-0" />

    <input
      v-model="q"
      type="text"
      enterkeyhint="search"
      class="flex-1 min-w-0 bg-transparent outline-none px-2 text-[15px] h-full"
      placeholder="搜索或输入网址，回车直达"
      autocomplete="off"
      spellcheck="false"
      @keydown.enter.prevent="go"
    />

    <button
      type="submit"
      class="grid place-items-center w-9 h-9 shrink-0 rounded-xl bg-ink text-bg transition-transform hover:scale-105 active:scale-95"
      aria-label="搜索"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
    </button>
  </form>

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
