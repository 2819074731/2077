<script setup lang="ts">
import { computed, ref } from 'vue'

const siteUrl = useRuntimeConfig().public.siteUrl
const canonicalUrl = `${siteUrl}/submit`
const { data: categoryData } = await useFetch('/api/categories')
const siteCategories = computed<string[]>(() => (categoryData.value as any)?.categories || [])

const faqs = [
  {
    q: '提交后多久能审核完成？',
    a: '通常 1-3 个工作日完成审核。收录结果以站内状态为准，审核期间无需重复提交。'
  },
  {
    q: '收录网站需要付费吗？',
    a: '不需要。2077 导航的首页导航与分类目录均为免费收录，不收取任何费用。'
  },
  {
    q: '哪些网站更容易通过审核？',
    a: '合法合规、可正常访问、内容原创或对用户有长期价值的网站更容易通过。采集站、镜像站、恶意跳转和弹窗站点不会被收录。'
  },
  {
    q: '首页导航和分类目录有什么区别？',
    a: '首页导航与分类目录共用同一套网站分类。首页导航审核更严格，只展示精选站点；分类目录按主题长期收录，符合条件的站点会生成独立详情页并进入站点地图。'
  },
  {
    q: '提示网站已提交过怎么办？',
    a: '说明该网址已在审核队列或已经收录，请勿重复提交。如需更新信息，可在原提交审核完成后再补充。'
  }
]

useSeoMeta({
  title: '提交网站收录 · 免费网址提交 | 2077 导航',
  description: '免费提交网站到 2077 导航，可选择首页精选导航或分类网站目录。支持一键抓取标题、描述、关键词与图标，人工审核后收录。',
  keywords: '提交网站,网址提交,网站收录,免费收录,网址导航,分类目录,2077 导航',
  ogTitle: '提交网站收录 · 2077 导航',
  ogDescription: '免费提交网站到 2077 导航，支持首页精选导航与分类网站目录，人工审核后收录。',
  ogType: 'website',
  ogUrl: canonicalUrl,
  twitterCard: 'summary'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${canonicalUrl}#webpage`,
          url: canonicalUrl,
          name: '提交网站收录 · 2077 导航',
          description: '免费提交网站到 2077 导航，支持首页精选导航与分类网站目录。',
          inLanguage: 'zh-CN',
          isPartOf: { '@id': `${siteUrl}/#website` }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${canonicalUrl}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl + '/' },
            { '@type': 'ListItem', position: 2, name: '提交收录', item: canonicalUrl }
          ]
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqs.map(f => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a }
          }))
        }
      ]
    })
  }]
}))

const form = ref({
  url: '', name: '', title: '', description: '', keywords: '', icon: '', group: '',
  target: 'nav', _trap: ''
})
const loading = ref(false)
const fetching = ref(false)
const err = ref('')
const ok = ref(false)
const checking = ref(false)
const check = ref<{ exists: boolean; inDirectory: boolean; status: string | null; token: string | null } | null>(null)
const submitted = ref<{ id: number; token: string } | null>(null)
let checkSeq = 0

const metaLoaded = computed(() => !!(form.value.title || form.value.description || form.value.keywords))
const checkHint = computed(() => {
  if (!check.value) return ''
  if (check.value.exists && check.value.inDirectory) return '该站点已提交过，且已收录在分类目录'
  if (check.value.exists) return '该站点已提交过，请勿重复提交'
  if (check.value.inDirectory) return '该站点已收录在分类目录'
  return ''
})

function chooseTarget(target: 'nav' | 'directory') {
  form.value.target = target
}

function validUrl(raw: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

async function fetchMeta() {
  err.value = ''
  const raw = form.value.url.trim()
  if (!raw) { err.value = '请先填写网址'; return }
  if (!validUrl(raw)) { err.value = '请输入有效的 http/https 网址'; return }
  fetching.value = true
  try {
    const d: any = await $fetch('/api/meta', { method: 'POST', body: { url: raw } })
    const m = d.meta
    if (m.title) form.value.title = m.title
    if (m.description) form.value.description = m.description
    if (m.keywords) form.value.keywords = m.keywords
    if (m.icon) form.value.icon = `/api/icon?url=${encodeURIComponent(m.host)}`
    if (!form.value.name.trim()) {
      form.value.name = m.title
        ? m.title.split(/[-_|·—]/)[0].trim().slice(0, 40)
        : new URL(raw).hostname.replace(/^www\./, '')
    }
  } catch (e: any) {
    err.value = e?.data?.statusMessage || e?.data?.message || '抓取失败，请手动填写'
  } finally {
    fetching.value = false
  }
  if (validUrl(raw)) void precheck()
}

async function precheck() {
  const raw = form.value.url.trim()
  if (!raw || !validUrl(raw)) {
    check.value = null
    checking.value = false
    return
  }
  const seq = ++checkSeq
  checking.value = true
  try {
    const d: any = await $fetch('/api/submit/check', { method: 'POST', body: { url: raw } })
    if (seq !== checkSeq || form.value.url.trim() !== raw) return
    check.value = {
      exists: !!d?.exists,
      inDirectory: !!d?.inDirectory,
      status: d?.status ? String(d.status) : null,
      token: d?.token ? String(d.token) : null
    }
  } catch {
    if (seq === checkSeq) check.value = null
  } finally {
    if (seq === checkSeq) checking.value = false
  }
}

function onUrlBlur() {
  void precheck()
}

function resetForm() {
  form.value = { url: '', name: '', title: '', description: '', keywords: '', icon: '', group: '', target: 'nav', _trap: '' }
  err.value = ''
  ok.value = false
  submitted.value = null
  check.value = null
  checking.value = false
  checkSeq++
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function submit() {
  err.value = ''
  const name = form.value.name.trim()
  const raw = form.value.url.trim()
  if (!name || !raw) { err.value = '请填写站点名称和网址'; return }
  if (!validUrl(raw)) { err.value = '请输入有效的 http/https 网址'; return }
  loading.value = true
  const group = siteCategories.value.includes(form.value.group) ? form.value.group : ''
  try {
    const d: any = await $fetch('/api/submit', {
      method: 'POST',
      body: { ...form.value, name, url: raw, group }
    })
    submitted.value = {
      id: Number(d?.id || 0),
      token: String(d?.token || '')
    }
    ok.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e: any) {
    err.value = e?.data?.statusMessage || e?.data?.message || '提交失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-8 sm:py-12">
    <div class="mx-auto w-full max-w-[720px] animate-fade-up">
      <header class="mb-6 sm:mb-8">
        <span class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-card2 border border-line text-[12px] font-medium text-ink2">
          <span class="w-1.5 h-1.5 rounded-full bg-success" />
          免费收录 · 人工审核
        </span>
        <h1 class="mt-3 text-[26px] sm:text-[32px] leading-tight font-bold tracking-tight">提交网站收录</h1>
        <p class="mt-2.5 text-[14px] sm:text-[14.5px] leading-7 text-ink2">
          推荐你的网站加入 2077 导航。可选择首页精选导航或
          <NuxtLink to="/site" class="font-medium text-ink underline decoration-line2 underline-offset-4 hover:decoration-ink">分类网站目录</NuxtLink>，
          审核通过后即可被用户访问和搜索。
        </p>
        <p class="mt-1.5 text-[13px] leading-6 text-ink2">填写网址后点「一键获取」，自动抓取标题、描述、关键词与图标，也可以手动修改。</p>
      </header>

      <div v-if="ok" class="card p-7 sm:p-9 text-center" role="status" aria-live="polite" aria-atomic="true">
        <div class="grid place-items-center w-14 h-14 rounded-2xl bg-card2 border border-line mx-auto mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h2 class="font-semibold text-xl">提交成功</h2>
        <p v-if="submitted?.id" class="text-[12.5px] text-ink3 mt-1.5">提交编号 #{{ submitted.id }}</p>
        <p class="text-ink2 text-[13.5px] leading-6 mt-2 max-w-[420px] mx-auto">
          我们已收到你的收录申请，通常会在 1-3 个工作日内完成审核。审核期间请勿重复提交。
        </p>
        <div class="flex flex-wrap justify-center gap-2 mt-6">
          <NuxtLink v-if="submitted?.token" :to="`/submit/status?token=${submitted.token}`" class="btn btn-primary">查看提交状态</NuxtLink>
          <button type="button" class="btn" :class="!submitted?.token ? 'btn-primary' : ''" @click="resetForm">继续提交</button>
          <NuxtLink to="/" class="btn">返回首页</NuxtLink>
        </div>
      </div>

      <form v-else class="card p-4 sm:p-7 flex flex-col gap-6" novalidate @submit.prevent="submit">
        <input v-model="form._trap" type="text" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true" />

        <section class="flex flex-col gap-3.5">
          <div class="flex items-center gap-2">
            <span class="grid place-items-center w-6 h-6 rounded-lg bg-ink text-bg text-[12px] font-semibold">1</span>
            <h2 class="font-semibold text-[15px]">网站信息</h2>
          </div>

          <label class="flex flex-col gap-1.5">
            <span class="text-[13.5px] font-medium">网址 <span class="text-danger">*</span></span>
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                v-model="form.url"
                class="field grow !h-11 sm:!h-[38px]"
                placeholder="https://example.com"
                inputmode="url"
                autocapitalize="off"
                spellcheck="false"
                maxlength="500"
                :aria-describedby="checkHint ? 'submit-url-hint submit-check-hint' : 'submit-url-hint'"
                @blur="onUrlBlur"
                @keyup.enter.prevent="fetchMeta"
              />
              <button type="button" class="btn shrink-0 !h-11 sm:!h-[38px]" :disabled="fetching" @click="fetchMeta">
                <svg v-if="!fetching" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                {{ fetching ? '抓取中…' : '一键获取' }}
              </button>
            </div>
            <span id="submit-url-hint" class="text-[12px] leading-5 text-ink2">仅支持公开可访问的 http/https 网址，单次提交一个站点。</span>
            <p v-if="checkHint" id="submit-check-hint" class="text-[12px] leading-5 text-warning" aria-live="polite">
              {{ checkHint }}
              <NuxtLink
                v-if="check?.token"
                :to="`/submit/status?token=${check.token}`"
                class="ml-1 text-ink underline decoration-line2 underline-offset-4 hover:decoration-ink"
              >查看状态</NuxtLink>
            </p>
            <p v-else-if="checking" class="text-[12px] leading-5 text-ink3">正在检查收录状态…</p>
          </label>

          <div class="grid sm:grid-cols-2 gap-3.5">
            <label class="flex flex-col gap-1.5">
              <span class="text-[13.5px] font-medium">站点名称 <span class="text-danger">*</span></span>
              <input v-model="form.name" class="field !h-11 sm:!h-[38px]" placeholder="例如 GitHub" maxlength="80" />
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="text-[13.5px] font-medium">网站分类</span>
              <select v-model="form.group" class="field !h-11 sm:!h-[38px] cursor-pointer">
                <option value="">由站长决定</option>
                <option v-for="g in siteCategories" :key="g" :value="g">{{ g }}</option>
              </select>
              <span class="text-[12px] leading-5 text-ink2">选择站点分类，留空表示由站长决定。</span>
            </label>
          </div>
        </section>

        <div class="h-px bg-line" />

        <section class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <span class="grid place-items-center w-6 h-6 rounded-lg bg-ink text-bg text-[12px] font-semibold">2</span>
            <h2 class="font-semibold text-[15px]">选择收录方式</h2>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              class="rounded-xl border p-3.5 text-left transition-colors"
              :class="form.target === 'nav' ? 'border-ink bg-accentsoft' : 'border-line bg-card hover:border-line2'"
              :aria-pressed="form.target === 'nav'"
              @click="chooseTarget('nav')"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="text-[14px] font-semibold">首页导航</span>
                <span class="w-4 h-4 rounded-full border grid place-items-center shrink-0" :class="form.target === 'nav' ? 'border-ink bg-ink' : 'border-line2'">
                  <span v-if="form.target === 'nav'" class="w-1.5 h-1.5 rounded-full bg-bg" />
                </span>
              </span>
              <span class="block text-[12.5px] leading-5 text-ink2 mt-1.5">进入首页精选分组，审核标准较高，只展示优质站点。</span>
            </button>
            <button
              type="button"
              class="rounded-xl border p-3.5 text-left transition-colors"
              :class="form.target === 'directory' ? 'border-ink bg-accentsoft' : 'border-line bg-card hover:border-line2'"
              :aria-pressed="form.target === 'directory'"
              @click="chooseTarget('directory')"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="text-[14px] font-semibold">分类目录</span>
                <span class="w-4 h-4 rounded-full border grid place-items-center shrink-0" :class="form.target === 'directory' ? 'border-ink bg-ink' : 'border-line2'">
                  <span v-if="form.target === 'directory'" class="w-1.5 h-1.5 rounded-full bg-bg" />
                </span>
              </span>
              <span class="block text-[12.5px] leading-5 text-ink2 mt-1.5">按主题长期收录，符合条件会生成独立详情页并进入站点地图。</span>
            </button>
          </div>
        </section>

        <div class="h-px bg-line" />

        <section class="flex flex-col gap-3.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="grid place-items-center w-6 h-6 rounded-lg bg-ink text-bg text-[12px] font-semibold">3</span>
            <h2 class="font-semibold text-[15px]">SEO 信息</h2>
            <span class="chip !text-[11px]">选填，可自动抓取</span>
            <span v-if="metaLoaded" class="text-[11.5px] text-success">已获取 TDK</span>
          </div>

          <label class="flex flex-col gap-1.5">
            <span class="text-[13.5px] font-medium">标题（Title）</span>
            <input v-model="form.title" class="field !h-11 sm:!h-[38px]" placeholder="自动抓取，可修改" maxlength="200" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="flex items-center justify-between gap-2">
              <span class="text-[13.5px] font-medium">描述（Description）</span>
              <span class="text-[11.5px] text-ink3">{{ form.description.length }}/500</span>
            </span>
            <textarea v-model="form.description" class="field !h-24 py-2.5 resize-y leading-6" placeholder="一两句话介绍网站内容与用途" maxlength="500" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13.5px] font-medium">关键词（Keywords）</span>
            <input v-model="form.keywords" class="field !h-11 sm:!h-[38px]" placeholder="导航,工具,资源" maxlength="300" />
          </label>

          <div v-if="form.icon" class="flex items-center gap-3 rounded-xl border border-line bg-card2 px-3 py-2.5 text-[13px] text-ink2">
            <SiteIcon :src="form.icon" :name="form.name" :url="form.url" class="w-8 h-8 rounded-lg shrink-0" />
            <span class="min-w-0 truncate">已获取站点图标，提交后由站长最终确认</span>
          </div>
        </section>

        <div class="rounded-xl border border-line bg-card2 p-3.5 flex items-start gap-2.5">
          <svg class="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
          <p class="text-[12.5px] leading-6 text-ink2">
            提交内容会经过格式过滤与人工审核。请勿提交恶意跳转、弹窗广告、侵权或违法违规内容，否则将被拒绝收录。
          </p>
        </div>

        <p v-if="err" class="text-[13px] leading-6 text-danger rounded-xl border border-danger bg-card2 px-3.5 py-2.5" role="alert" aria-live="polite">{{ err }}</p>

        <button class="btn btn-primary h-11 w-full text-[14.5px]" type="submit" :disabled="loading || fetching">
          {{ loading ? '提交中…' : '提交收录' }}
        </button>
      </form>

      <section class="card p-5 sm:p-7 mt-6" aria-labelledby="submit-guide-title">
        <h2 id="submit-guide-title" class="font-semibold text-[17px]">收录说明</h2>
        <div class="grid sm:grid-cols-2 gap-4 sm:gap-5 mt-4">
          <div>
            <h3 class="text-[13.5px] font-medium">审核时间</h3>
            <p class="text-[13px] leading-6 text-ink2 mt-1">通常 1-3 个工作日完成审核，无需重复提交。</p>
          </div>
          <div>
            <h3 class="text-[13.5px] font-medium">收录标准</h3>
            <p class="text-[13px] leading-6 text-ink2 mt-1">网站需合法合规、可正常访问，并提供原创或有长期价值的内容。</p>
          </div>
          <div>
            <h3 class="text-[13.5px] font-medium">首页导航与分类目录</h3>
            <p class="text-[13px] leading-6 text-ink2 mt-1">首页导航展示精选站点；分类目录按主题长期收录并支持独立详情页。</p>
          </div>
          <div>
            <h3 class="text-[13.5px] font-medium">关于重复提交</h3>
            <p class="text-[13px] leading-6 text-ink2 mt-1">同一网址只保留一条记录，重复提交会被自动拦截。</p>
          </div>
        </div>

        <div class="mt-6 pt-5 border-t border-line flex flex-col gap-3">
          <h2 class="font-semibold text-[17px]">常见问题</h2>
          <div v-for="f in faqs" :key="f.q">
            <h3 class="text-[13.5px] font-medium">{{ f.q }}</h3>
            <p class="text-[13px] leading-6 text-ink2 mt-1">{{ f.a }}</p>
          </div>
        </div>

        <p class="text-[12.5px] leading-6 text-ink2 mt-5">
          也可以先浏览
          <NuxtLink to="/site" class="text-ink underline decoration-line2 underline-offset-4 hover:decoration-ink">分类目录</NuxtLink>
          和
          <NuxtLink to="/sitemap" class="text-ink underline decoration-line2 underline-offset-4 hover:decoration-ink">站点地图</NuxtLink>
          ，确认网站是否已经收录。
        </p>
      </section>
    </div>
  </div>
</template>
