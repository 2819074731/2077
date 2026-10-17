<script setup lang="ts">
import { computed } from 'vue'

const route = useRoute()
const siteUrl = useRuntimeConfig().public.siteUrl
const id = computed(() => String(route.params.id || '').replace(/\.html?$/i, ''))

const { data, error } = await useAsyncData(
  `directory-detail-${id.value}`,
  () => $fetch(`/api/directory/${id.value}`),
  { watch: [id] }
)

if (error.value || !(data.value as any)?.item) {
  throw createError({ statusCode: 404, statusMessage: '页面不存在' })
}

const item = computed<any>(() => (data.value as any)?.item || {})
const related = computed<any[]>(() => (data.value as any)?.related || [])
const host = computed(() => {
  try { return new URL(item.value.url).hostname } catch { return item.value.url }
})
const pageTitle = computed(() => item.value.title || `${item.value.name} - ${item.value.category}网站推荐 | 2077 导航`)
const pageDesc = computed(() =>
  item.value.description || `${item.value.name}（${host.value}）收录在 2077 导航「${item.value.category}」分类，提供官网入口、站点简介与同类站点推荐。`
)
const paragraphs = computed<string[]>(() => {
  const text = String(item.value.content || '').trim()
  if (text) return text.split(/\n+/).map((s: string) => s.trim()).filter(Boolean)
  return [
    `${item.value.name} 是收录在 2077 导航「${item.value.category}」分类下的站点，官网地址为 ${host.value}。`,
    `本页整理了该站点的基本信息、官网入口与同类站点推荐，方便你快速判断是否值得访问。`
  ]
})
const created = computed(() => {
  try { return new Date(item.value.created_at).toLocaleDateString('zh-CN') } catch { return '' }
})

useSeoMeta({
  title: pageTitle,
  description: pageDesc,
  keywords: () => item.value.keywords || `${item.value.name},${item.value.category},网址导航,网站目录`,
  ogTitle: pageTitle,
  ogDescription: pageDesc,
  ogType: 'article',
  ogUrl: () => `${siteUrl}/site/${item.value.id}.html`,
  robots: 'index,follow'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}/site/${item.value.id}.html` }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: item.value.name,
          url: item.value.url,
          description: pageDesc.value
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl + '/' },
            { '@type': 'ListItem', position: 2, name: '分类目录', item: siteUrl + '/site' },
            { '@type': 'ListItem', position: 3, name: item.value.category, item: `${siteUrl}/site?category=${encodeURIComponent(item.value.category)}` },
            { '@type': 'ListItem', position: 4, name: item.value.name, item: `${siteUrl}/site/${item.value.id}.html` }
          ]
        }
      ]
    })
  }]
}))
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-6 sm:py-10">
    <nav class="flex items-center gap-1.5 text-[12px] text-ink3 mb-5 flex-wrap">
      <NuxtLink to="/" class="hover:text-ink">首页</NuxtLink>
      <span>/</span>
      <NuxtLink to="/site" class="hover:text-ink">分类目录</NuxtLink>
      <span>/</span>
      <NuxtLink :to="`/site?category=${encodeURIComponent(item.category)}`" class="hover:text-ink">{{ item.category }}</NuxtLink>
      <span>/</span>
      <span class="text-ink2 truncate max-w-[220px]">{{ item.name }}</span>
    </nav>

    <div class="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
      <article class="card p-5 sm:p-7">
        <header class="flex items-start gap-4 flex-col sm:flex-row">
          <img :src="item.icon || `/api/icon?url=${encodeURIComponent(host)}`" alt="" class="w-14 h-14 rounded-2xl shrink-0" referrerpolicy="no-referrer" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-[24px] sm:text-[30px] font-extrabold tracking-tight leading-tight">{{ item.name }}</h1>
              <span v-if="item.featured" class="chip">精选</span>
            </div>
            <p class="text-[12.5px] text-ink3 mt-1">{{ item.category }} · {{ host }}</p>
            <p class="text-[13.5px] text-ink2 mt-2 leading-relaxed">{{ pageDesc }}</p>
          </div>
        </header>

        <div class="flex flex-wrap gap-2 mt-5">
          <a :href="item.url" target="_blank" rel="nofollow noopener" class="btn btn-primary">访问官网</a>
          <NuxtLink :to="`/site?category=${encodeURIComponent(item.category)}`" class="btn btn-ghost">同类站点</NuxtLink>
          <NuxtLink to="/submit" class="btn btn-ghost">提交纠错</NuxtLink>
        </div>

        <div class="prose-none mt-6">
          <h2 class="text-[16px] font-semibold mb-2">站点简介</h2>
          <p v-for="(p, i) in paragraphs" :key="i" class="text-[13.5px] text-ink2 leading-7 mb-2">{{ p }}</p>
        </div>

        <dl class="grid sm:grid-cols-2 gap-3 mt-6 pt-5 border-t border-line text-[13px]">
          <div>
            <dt class="text-ink3 text-[11.5px] mb-0.5">官网地址</dt>
            <dd class="break-all"><a :href="item.url" target="_blank" rel="nofollow noopener" class="text-ink hover:underline">{{ item.url }}</a></dd>
          </div>
          <div>
            <dt class="text-ink3 text-[11.5px] mb-0.5">所属分类</dt>
            <dd>{{ item.category }}</dd>
          </div>
          <div>
            <dt class="text-ink3 text-[11.5px] mb-0.5">收录时间</dt>
            <dd>{{ created }}</dd>
          </div>
          <div>
            <dt class="text-ink3 text-[11.5px] mb-0.5">收录编号</dt>
            <dd>#{{ item.id }}</dd>
          </div>
        </dl>
      </article>

      <aside class="flex flex-col gap-4">
        <section class="card p-4">
          <h2 class="font-semibold text-[14px] mb-3">相关推荐</h2>
          <div v-if="!related.length" class="text-[12.5px] text-ink3">暂无相关站点</div>
          <div v-else class="flex flex-col gap-2.5">
            <component
              :is="r.detail_enabled ? 'NuxtLink' : 'a'"
              v-for="r in related"
              :key="r.id"
              v-bind="r.detail_enabled ? { to: `/site/${r.id}.html` } : { href: r.url, target: '_blank', rel: 'nofollow noopener' }"
              class="flex items-center gap-2.5 group"
            >
              <img :src="r.icon || `/api/icon?url=${encodeURIComponent(new URL(r.url).hostname)}`" alt="" class="w-7 h-7 rounded-lg shrink-0" loading="lazy" referrerpolicy="no-referrer" />
              <span class="min-w-0">
                <span class="block text-[13px] font-medium truncate group-hover:underline">{{ r.name }}</span>
                <span class="block text-[11px] text-ink3 truncate">{{ r.category }}</span>
              </span>
            </component>
          </div>
        </section>
        <section class="card p-4 text-[12.5px] text-ink2 leading-relaxed">
          <h2 class="font-semibold text-[14px] text-ink mb-2">关于分类目录</h2>
          分类目录与首页导航分开维护：首页只展示精选导航，目录站点拥有独立介绍页，便于搜索引擎收录与长期沉淀。
        </section>
      </aside>
    </div>
  </div>
</template>
