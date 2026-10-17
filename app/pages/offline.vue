<script setup lang="ts">
useSeoMeta({
  title: '离线 · 2077 导航',
  description: '当前网络不可用。',
  robots: 'noindex'
})

function retry() {
  window.location.reload()
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-16 sm:py-24 flex justify-center">
    <section class="w-full max-w-[480px] card p-6 sm:p-8 text-center" aria-labelledby="offline-title">
      <div class="grid place-items-center w-14 h-14 rounded-2xl bg-card2 border border-line mx-auto mb-4">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
          <path d="M12 20h.01M3 3l18 18" />
        </svg>
      </div>
      <h1 id="offline-title" class="font-semibold text-xl">当前处于离线状态</h1>
      <p class="text-[13.5px] leading-6 text-ink2 mt-2">
        网络连接似乎已断开。已缓存的页面仍可访问，恢复网络后即可继续使用全部功能。
      </p>
      <div class="flex flex-wrap justify-center gap-2 mt-6">
        <button type="button" class="btn btn-primary" @click="retry">重新加载</button>
        <NuxtLink to="/" class="btn">返回首页</NuxtLink>
      </div>
    </section>
  </div>
</template>
