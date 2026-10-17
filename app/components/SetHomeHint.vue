<script setup lang="ts">
import { ref, computed } from 'vue'
const open = ref(false)
const copied = ref(false)
const url = computed(() => (import.meta.client ? location.origin + '/' : 'https://my2077.com/'))
async function copy() {
  try { await navigator.clipboard.writeText(url.value); copied.value = true; setTimeout(() => (copied.value = false), 1600) } catch {}
}
</script>

<template>
  <button class="btn btn-sm btn-ghost" @click="open = true">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
    设为首页
  </button>

  <div v-if="open" class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4" @click.self="open = false">
    <div class="card w-full max-w-md p-6 animate-fade-up">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold m-0">设为浏览器首页</h3>
        <button class="grid place-items-center w-7 h-7 rounded-lg text-ink2 hover:bg-card2 hover:text-ink" @click="open = false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <p class="text-ink2 text-[13px] mb-3">把下面的地址填进浏览器「启动时打开」或「主页」设置即可。</p>
      <div class="flex gap-2">
        <input class="field grow font-mono text-[12.5px]" :value="url" readonly @focus="($event.target as HTMLInputElement).select()" />
        <button class="btn btn-primary shrink-0" @click="copy">{{ copied ? '已复制' : '复制' }}</button>
      </div>
      <div class="mt-5 grid gap-2 text-[13px] text-ink2">
        <p class="flex gap-2"><b class="text-ink shrink-0 w-[86px]">Chrome / Edge</b><span>设置 → 启动时 → 打开特定网页</span></p>
        <p class="flex gap-2"><b class="text-ink shrink-0 w-[86px]">Firefox</b><span>设置 → 主页 → 自定义网址</span></p>
        <p class="flex gap-2"><b class="text-ink shrink-0 w-[86px]">移动端</b><span>浏览器菜单 → 添加到主屏幕</span></p>
      </div>
    </div>
  </div>
</template>
