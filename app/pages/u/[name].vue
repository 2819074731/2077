<script setup lang="ts">
import { computed } from 'vue'
const route = useRoute()
const slug = computed(() => String(route.params.name || ''))
const { data, error } = await useFetch(() => `/api/u/${slug.value}`)
const profile = computed(() => (data.value as any)?.profile)
const links = computed(() => (data.value as any)?.links || [])
const siteUrl = useRuntimeConfig().public.siteUrl

useSeoMeta({
  title: () => profile.value ? `${profile.value.nickname} 的云端网址 · my2077` : '用户 · my2077',
  description: () => profile.value ? `${profile.value.nickname} 在 my2077 分享的云端网址导航。` : '',
  robots: 'index,follow'
})
useHead({
  link: [{ rel: 'canonical', href: () => siteUrl + '/u/' + slug.value }],
  script: computed(() => profile.value ? [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: profile.value.nickname,
      url: siteUrl + '/u/' + slug.value,
      sameAs: links.value.map((l: any) => l.url)
    })
  }] : [])
})
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-12">
    <div v-if="error || !profile" class="text-ink2 py-20 text-center">
      <p class="text-lg font-medium text-ink mb-1">未找到该用户</p>
      <p class="text-[13px]"><NuxtLink to="/" class="text-accent hover:underline">返回首页</NuxtLink></p>
    </div>
    <template v-else>
      <header class="flex items-center gap-4 mb-8 animate-fade-up">
        <span class="grid place-items-center w-14 h-14 rounded-2xl bg-ink text-bg text-xl font-semibold shadow-soft">{{ (profile.nickname || 'U')[0].toUpperCase() }}</span>
        <div>
          <h1 class="text-xl font-semibold">{{ profile.nickname }}</h1>
          <p class="text-[13px] text-ink2">my2077 用户 · {{ links.length }} 个云端网址</p>
        </div>
      </header>

      <div v-if="!links.length" class="text-ink2 text-[13px] py-10 text-center border border-dashed border-line rounded-2xl">
        该用户还没有公开的云端网址。
      </div>
      <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <a v-for="(l, i) in links" :key="i" :href="l.url" target="_blank" rel="noopener" class="linkcard flex items-center gap-3 px-3.5 h-[58px]">
          <span class="grid place-items-center w-9 h-9 rounded-xl bg-card2 border border-line text-[14px] font-bold text-ink2 shrink-0">{{ (l.name || '?')[0].toUpperCase() }}</span>
          <span class="min-w-0">
            <span class="block text-[13.5px] font-medium truncate">{{ l.name }}</span>
            <span class="block text-[11px] text-ink2 truncate mt-0.5">{{ l.url }}</span>
          </span>
        </a>
      </div>
    </template>
  </div>
</template>
