<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ category: string }>()
const { linkCols } = useDevice()
const { data, pending } = await useFetch('/api/directory', {
  query: { category: props.category, page: 1, size: 24 },
  key: `directory-cat-${props.category}`
})

const items = computed<any[]>(() => (data.value as any)?.items || [])
const total = computed(() => Number((data.value as any)?.total || 0))
const links = computed(() => items.value.map((e: any) => ({ id: String(e.id), name: e.name, url: e.url, icon: e.icon })))
const more = computed(() => `/site?category=${encodeURIComponent(props.category)}`)
</script>

<template>
  <section class="mb-8">
    <div class="flex items-center gap-2.5 mb-3.5">
      <span class="h-4 w-1 rounded-full accent-bar" />
      <h2 class="text-[15px] font-semibold tracking-tight">{{ category }}</h2>
      <span class="chip">{{ total }}</span>
      <div class="flex-1" />
      <NuxtLink :to="more" class="text-[12px] text-ink2 hover:text-ink">查看全部</NuxtLink>
    </div>
    <div v-if="links.length" class="grid gap-3" :class="linkCols">
      <LinkItem v-for="link in links" :key="link.id" gid="" :link="link" />
    </div>
    <div v-else-if="!pending" class="card p-6 text-center">
      <p class="text-[12.5px] text-ink2">该分类暂无收录内容。</p>
      <NuxtLink :to="more" class="btn btn-sm btn-primary mt-3">打开分类目录</NuxtLink>
    </div>
  </section>
</template>
