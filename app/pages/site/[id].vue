<script setup lang="ts">
import { computed } from 'vue'
import { useNav } from '~/composables/useNav'

const route = useRoute()
const siteUrl = useRuntimeConfig().public.siteUrl
const { recordClick } = useNav()
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
const prev = computed<any>(() => (data.value as any)?.prev || null)
const next = computed<any>(() => (data.value as any)?.next || null)
const categories = computed<any[]>(() => (data.value as any)?.categories || [])
const latest = computed<any[]>(() => (data.value as any)?.latest || [])
const host = computed(() => {
  try { return new URL(item.value.url).hostname } catch { return item.value.url }
})
const pageUrl = computed(() => `${siteUrl}/site/${item.value.id}.html`)
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
const faqs = computed(() => [
  {
    q: `${item.value.name} 是什么网站？`,
    a: item.value.description || `${item.value.name} 是收录在 2077 导航「${item.value.category}」分类下的站点。`
  },
  {
    q: `${item.value.name} 的官网地址是什么？`,
    a: `官网地址为 ${item.value.url}，可通过本页的「访问官网」按钮直接打开。`
  },
  {
    q: `${item.value.name} 收录在哪个分类？`,
    a: `收录于「${item.value.category}」分类，可在分类目录中浏览同类站点。`
  },
  {
    q: '如何提交类似网站？',
    a: '可通过 2077 导航的提交收录页面推荐网站，首页导航审核标准较高，分类目录长期开放收录。'
  }
])
const created = computed(() => {
  try { return new Date(item.value.created_at).toLocaleDateString('zh-CN') } catch { return '' }
})
const updated = computed(() => {
  try { return new Date(item.value.updated_at || item.value.created_at).toLocaleDateString('zh-CN') } catch { return '' }
})
const createdIso = computed(() => {
  try { return new Date(item.value.created_at).toISOString() } catch { return undefined }
})
const updatedIso = computed(() => {
  try { return new Date(item.value.updated_at || item.value.created_at).toISOString() } catch { return undefined }
})

function iconOf(url: string) {
  try { return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}` } catch { return '' }
}

useSeoMeta({
  title: pageTitle,
  description: pageDesc,
  keywords: () => item.value.keywords || `${item.value.name},${item.value.category},网址导航,网站目录`,
  ogTitle: pageTitle,
  ogDescription: pageDesc,
  ogType: 'article',
  ogUrl: pageUrl,
  robots: 'index,follow',
  articleModifiedTime: updatedIso
})

useHead(() => ({
  link: [{ rel: 'canonical', href: pageUrl.value }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': pageUrl.value + '#webpage',
          url: pageUrl.value,
          name: pageTitle.value,
          description: pageDesc.value,
          inLanguage: 'zh-CN',
          isPartOf: { '@id': siteUrl + '/#website' },
          publisher: { '@id': siteUrl + '/#organization' },
          datePublished: createdIso.value,
          dateModified: updatedIso.value,
          about: {
            '@type': 'WebSite',
            name: item.value.name,
            url: item.value.url,
            description: pageDesc.value
          },
          breadcrumb: { '@id': pageUrl.value + '#breadcrumb' }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': pageUrl.value + '#breadcrumb',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl + '/' },
            { '@type': 'ListItem', position: 2, name: '分类目录', item: siteUrl + '/site' },
            { '@type': 'ListItem', position: 3, name: item.value.category, item: `${siteUrl}/site?category=${encodeURIComponent(item.value.category)}` },
            { '@type': 'ListItem', position: 4, name: item.value.name, item: pageUrl.value }
          ]
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqs.value.map(f => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a }
          }))
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
          <SiteIcon :src="item.icon || iconOf(item.url)" :name="item.name" :url="item.url" class="w-14 h-14 rounded-2xl shrink-0 text-[20px]" />
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
          <a :href="item.url" target="_blank" rel="nofollow noopener" class="btn btn-primary" @click="recordClick(item.url, item.name)">访问官网</a>
          <NuxtLink :to="`/site?category=${encodeURIComponent(item.category)}`" class="btn btn-ghost">同类站点</NuxtLink>
          <NuxtLink to="/sitemap" class="btn btn-ghost">站点地图</NuxtLink>
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
            <dt class="text-ink3 text-[11.5px] mb-0.5">最后更新</dt>
            <dd>{{ updated }}</dd>
          </div>
        </dl>

        <section class="mt-7 pt-6 border-t border-line">
          <h2 class="text-[16px] font-semibold mb-3">常见问题</h2>
          <dl class="flex flex-col gap-4">
            <div v-for="f in faqs" :key="f.q">
              <dt class="text-[13.5px] font-medium">{{ f.q }}</dt>
              <dd class="text-[13px] text-ink2 leading-7 mt-1">{{ f.a }}</dd>
            </div>
          </dl>
        </section>

        <nav v-if="prev || next" class="mt-7 pt-6 border-t border-line grid sm:grid-cols-2 gap-2" aria-label="同分类上下站">
          <NuxtLink
            v-if="prev"
            :to="`/site/${prev.id}.html`"
            class="flex flex-col rounded-xl border border-line px-3 py-2.5 hover:border-ink/30 transition-colors"
          >
            <span class="text-[11.5px] text-ink3">上一站</span>
            <span class="text-[13.5px] font-medium truncate">← {{ prev.name }}</span>
          </NuxtLink>
          <span v-else />
          <NuxtLink
            v-if="next"
            :to="`/site/${next.id}.html`"
            class="flex flex-col rounded-xl border border-line px-3 py-2.5 hover:border-ink/30 transition-colors sm:text-right sm:items-end"
          >
            <span class="text-[11.5px] text-ink3">下一站</span>
            <span class="text-[13.5px] font-medium truncate">{{ next.name }} →</span>
          </NuxtLink>
        </nav>
      </article>

      <aside class="flex flex-col gap-4">
        <section class="card p-4">
          <h2 class="font-semibold text-[14px] mb-3">相关推荐</h2>
          <div v-if="!related.length" class="text-[12.5px] text-ink3">暂无相关站点</div>
          <div v-else class="flex flex-col gap-2.5">
            <template v-for="r in related" :key="r.id">
              <NuxtLink
                v-if="r.detail_enabled"
                :to="`/site/${r.id}.html`"
                class="flex items-center gap-2.5 group"
              >
                <SiteIcon :src="r.icon || iconOf(r.url)" :name="r.name" :url="r.url" class="w-7 h-7 rounded-lg shrink-0 text-[11px]" />
                <span class="min-w-0">
                  <span class="block text-[13px] font-medium truncate group-hover:underline">{{ r.name }}</span>
                  <span class="block text-[11px] text-ink3 truncate">{{ r.category }}</span>
                </span>
              </NuxtLink>
              <a
                v-else
                :href="r.url"
                target="_blank"
                rel="nofollow noopener"
                class="flex items-center gap-2.5 group"
              >
                <SiteIcon :src="r.icon || iconOf(r.url)" :name="r.name" :url="r.url" class="w-7 h-7 rounded-lg shrink-0 text-[11px]" />
                <span class="min-w-0">
                  <span class="block text-[13px] font-medium truncate group-hover:underline">{{ r.name }}</span>
                  <span class="block text-[11px] text-ink3 truncate">{{ r.category }}</span>
                </span>
              </a>
            </template>
          </div>
        </section>

        <section class="card p-4">
          <h2 class="font-semibold text-[14px] mb-3">全部分类</h2>
          <div class="flex flex-wrap gap-1.5">
            <NuxtLink
              v-for="c in categories"
              :key="c.category"
              :to="`/site?category=${encodeURIComponent(c.category)}`"
              class="chip hover:text-ink"
            >{{ c.category }} {{ c.n }}</NuxtLink>
          </div>
        </section>

        <section class="card p-4">
          <h2 class="font-semibold text-[14px] mb-3">最新收录</h2>
          <div class="flex flex-col gap-2.5">
            <template v-for="r in latest" :key="'latest-' + r.id">
              <NuxtLink
                v-if="r.detail_enabled"
                :to="`/site/${r.id}.html`"
                class="flex items-center gap-2.5 group"
              >
                <SiteIcon :src="r.icon || iconOf(r.url)" :name="r.name" :url="r.url" class="w-7 h-7 rounded-lg shrink-0 text-[11px]" />
                <span class="min-w-0">
                  <span class="block text-[13px] font-medium truncate group-hover:underline">{{ r.name }}</span>
                  <span class="block text-[11px] text-ink3 truncate">{{ r.category }}</span>
                </span>
              </NuxtLink>
              <a
                v-else
                :href="r.url"
                target="_blank"
                rel="nofollow noopener"
                class="flex items-center gap-2.5 group"
              >
                <SiteIcon :src="r.icon || iconOf(r.url)" :name="r.name" :url="r.url" class="w-7 h-7 rounded-lg shrink-0 text-[11px]" />
                <span class="min-w-0">
                  <span class="block text-[13px] font-medium truncate group-hover:underline">{{ r.name }}</span>
                  <span class="block text-[11px] text-ink3 truncate">{{ r.category }}</span>
                </span>
              </a>
            </template>
          </div>
        </section>

        <section class="card p-4 text-[12.5px] text-ink2 leading-relaxed">
          <h2 class="font-semibold text-[14px] text-ink mb-2">关于分类目录</h2>
          分类目录与首页导航分开维护：首页只展示精选导航，目录站点拥有独立介绍页，便于搜索引擎收录与长期沉淀。
          <NuxtLink to="/sitemap" class="block mt-2 text-ink hover:underline">查看完整站点地图</NuxtLink>
        </section>
      </aside>
    </div>
  </div>
</template>
