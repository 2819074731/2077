<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import {
  DEFAULT_GOOGLE_SEARCH_RELAYS,
  DEFAULT_GITHUB_SEARCH_RELAYS,
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  type GithubSettings,
  type GoogleSearchSettings
} from '#shared/siteSettings'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const form = reactive<GithubSettings>({ ...DEFAULT_SITE_SETTINGS.github })
const googleForm = reactive<GoogleSearchSettings>({
  ...DEFAULT_SITE_SETTINGS.google,
  relays: [...DEFAULT_GOOGLE_SEARCH_RELAYS]
})
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const msgKind = ref<'ok' | 'err'>('ok')

const tabs = [
  { id: 'google', label: 'Google 搜索' },
  { id: 'search', label: 'GitHub 搜索' },
  { id: 'source', label: 'GitHub 数据源' },
  { id: 'content', label: '项目页' },
  { id: 'download', label: '下载' },
  { id: 'image', label: '图片' }
] as const
const activeTab = ref<typeof tabs[number]['id']>('google')
const testingRelays = ref(false)
const relayHealthList = ref<any[]>([])
const testingGoogleRelays = ref(false)
const googleRelayHealthList = ref<any[]>([])
const loadedGoogle = ref(false)

useSeoMeta({ title: '引擎设置 · 2077 管理后台', robots: 'noindex' })

function flash(text: string, kind: 'ok' | 'err' = 'ok') {
  msg.value = text
  msgKind.value = kind
  setTimeout(() => { if (msg.value === text) msg.value = '' }, kind === 'err' ? 4800 : 2200)
}

function apply(raw: any) {
  Object.assign(form, normalizeSiteSettings({ ...DEFAULT_SITE_SETTINGS, github: raw }).github)
}

function applyGoogle(raw: any) {
  Object.assign(googleForm, normalizeSiteSettings({ ...DEFAULT_SITE_SETTINGS, google: raw }).google)
}

function addRelay() {
  if (form.searchRelays.length >= 6) return
  form.searchRelays.push('')
}

function removeRelay(index: number) {
  form.searchRelays.splice(index, 1)
}

function moveRelay(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= form.searchRelays.length) return
  const [item] = form.searchRelays.splice(index, 1)
  if (item === undefined) return
  form.searchRelays.splice(next, 0, item)
}

function resetRelays() {
  form.searchRelays = [...DEFAULT_GITHUB_SEARCH_RELAYS]
}

function addGoogleRelay() {
  if (googleForm.relays.length >= 6) return
  googleForm.relays.push('')
}

function removeGoogleRelay(index: number) {
  googleForm.relays.splice(index, 1)
}

function moveGoogleRelay(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= googleForm.relays.length) return
  const [item] = googleForm.relays.splice(index, 1)
  if (item === undefined) return
  googleForm.relays.splice(next, 0, item)
}

function resetGoogleRelays() {
  googleForm.relays = [...DEFAULT_GOOGLE_SEARCH_RELAYS]
}

function relayHost(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.search ? `${parsed.host}${parsed.pathname}` : parsed.host
  } catch { return url }
}

async function testGoogleRelays() {
  if (testingGoogleRelays.value) return
  testingGoogleRelays.value = true
  try {
    const data: any = await $fetch('/api/admin/google-relay-health', { method: 'POST' })
    googleRelayHealthList.value = data?.relays || []
    const ok = googleRelayHealthList.value.filter(r => r.ok).length
    flash(ok ? `Google 线路可用 ${ok}/${googleRelayHealthList.value.length}` : '所有 Google 中转线路当前不可用', ok ? 'ok' : 'err')
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || 'Google 线路测试失败', 'err')
  } finally {
    testingGoogleRelays.value = false
  }
}

async function testRelays() {
  if (testingRelays.value) return
  testingRelays.value = true
  try {
    const data: any = await $fetch('/api/admin/github-relay-health', { method: 'POST' })
    relayHealthList.value = data?.relays || []
    const ok = relayHealthList.value.filter(r => r.ok).length
    flash(ok ? `线路可用 ${ok}/${relayHealthList.value.length}，搜索会优先走可用线路` : '所有中转线路当前不可用', ok ? 'ok' : 'err')
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '线路测试失败', 'err')
  } finally {
    testingRelays.value = false
  }
}

function validateRelays(): string {
  const seen = new Set<string>()
  for (const value of form.searchRelays) {
    const raw = value.trim()
    if (!raw) continue
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return `中转线路格式不正确：${raw}`
    }
    if (url.protocol !== 'https:') return '中转线路必须使用 https'
    if (url.username || url.password) return '中转线路不能包含账号密码'
    if (url.search || url.hash) return '中转线路不能包含查询参数或锚点'
    const normalized = url.href.replace(/\/$/, '')
    if (seen.has(normalized)) return `中转线路重复：${normalized}`
    seen.add(normalized)
  }
  return ''
}

onMounted(async () => {
  try {
    const data: any = await $fetch('/api/admin/engine-settings')
    apply(data?.github)
    applyGoogle(data?.google)
    loadedGoogle.value = !!data?.google
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '配置读取失败', 'err')
  } finally {
    loading.value = false
  }
})

function validateGoogleRelays(): string {
  for (const value of googleForm.relays) {
    const raw = value.trim()
    if (!raw) continue
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return `Google 中转线路格式不正确：${raw}`
    }
    if (url.protocol !== 'https:') return 'Google 中转线路必须使用 https'
    if (url.username || url.password) return 'Google 中转线路不能包含账号密码'
    if (url.hash) return 'Google 中转线路不能包含锚点'
  }
  return ''
}

function validateGoogle(): string {
  const relayError = validateGoogleRelays()
  if (relayError) return relayError
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(googleForm.language)) return 'Google 语言代码格式不正确，例如 zh-CN'
  if (googleForm.pageSize < 10 || googleForm.pageSize > 30) return 'Google 每页结果需在 10-30 之间'
  if (googleForm.maxPages < 1 || googleForm.maxPages > 10) return 'Google 最大页数需在 1-10 之间'
  if (googleForm.cacheSec < 60 || googleForm.cacheSec > 3600) return 'Google 搜索缓存需在 60-3600 秒之间'
  if (googleForm.timeoutMs < 2000 || googleForm.timeoutMs > 15000) return 'Google 中转超时需在 2000-15000 毫秒之间'
  return ''
}

function validate(): string {
  if (!['best', 'stars', 'forks', 'updated'].includes(form.defaultSort)) return 'GitHub 默认排序不正确'
  const relayError = validateRelays()
  if (relayError) return relayError
  if (form.pageSize < 10 || form.pageSize > 30) return 'GitHub 每页结果需在 10-30 之间'
  if (form.maxPages < 1 || form.maxPages > 20) return 'GitHub 最大页数需在 1-20 之间'
  if (form.readmeMaxKB < 32 || form.readmeMaxKB > 512) return 'README 上限需在 32-512 KB 之间'
  if (form.filePreviewMaxKB < 64 || form.filePreviewMaxKB > 2048) return '文件预览上限需在 64-2048 KB 之间'
  if (form.maxZipMB < 10 || form.maxZipMB > 1024) return '源码 ZIP 上限需在 10-1024 MB 之间'
  if (form.maxAssetMB < 10 || form.maxAssetMB > 2048) return 'Release 附件上限需在 10-2048 MB 之间'
  if (form.rawMaxMB < 1 || form.rawMaxMB > 100) return '原文件上限需在 1-100 MB 之间'
  if (form.assetTtlSec < 60 || form.assetTtlSec > 3600) return '资源链接有效期需在 60-3600 秒之间'
  if (form.imageMaxMB < 1 || form.imageMaxMB > 50) return '图片大小上限需在 1-50 MB 之间'
  if (form.imageRatePerMin < 10 || form.imageRatePerMin > 300) return '图片限流需在 10-300 次/分钟之间'
  for (const [label, value, min, max] of [
    ['搜索缓存', form.searchCacheSec, 60, 3600],
    ['仓库缓存', form.repoCacheSec, 60, 3600],
    ['README 缓存', form.readmeCacheSec, 60, 3600]
  ] as const) {
    if (value < min || value > max) return `${label}需在 ${min}-${max} 秒之间`
  }
  return ''
}

async function save() {
  if (saving.value) return
  const error = validate()
  if (error) { flash(error, 'err'); return }
  const googleError = loadedGoogle.value ? validateGoogle() : ''
  if (googleError) { flash(googleError, 'err'); return }
  saving.value = true
  try {
    const relays = form.searchRelays.map(value => value.trim()).filter(Boolean)
    const googleRelays = googleForm.relays.map(value => value.trim()).filter(Boolean)
    const data: any = await $fetch('/api/admin/engine-settings', {
      method: 'PUT',
      body: {
        github: { ...form, searchRelays: relays },
        ...(loadedGoogle.value ? { google: { ...googleForm, relays: googleRelays } } : {})
      }
    })
    apply(data?.github)
    if (data?.google) {
      applyGoogle(data.google)
      loadedGoogle.value = true
    }
    flash('已保存，前台约 15 秒内生效')
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '保存失败', 'err')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="animate-fade-up max-w-[900px]">
    <div class="flex items-start gap-2 mb-4 flex-wrap">
      <p class="text-[13px] text-ink2 flex-1 min-w-[220px] leading-relaxed">
        管理 Google 中转、GitHub 搜索的开关与数据源，以及内容展示与下载限制。保存后前台约 15 秒内生效。
      </p>
      <span v-if="msg" class="text-[12.5px] w-full sm:w-auto" :class="msgKind === 'err' ? 'text-danger' : 'text-ink2'">{{ msg }}</span>
      <button class="btn btn-sm btn-primary w-full sm:w-auto" :disabled="saving || loading" @click="save">{{ saving ? '保存中…' : '保存设置' }}</button>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>

    <form v-else class="card overflow-hidden" novalidate @submit.prevent="save">
      <div class="border-b border-line bg-card2/40 p-2.5 sm:p-3">
        <div role="tablist" aria-label="引擎设置分类" class="flex gap-1 rounded-xl border border-line bg-card2 p-1 overflow-x-auto no-scrollbar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            class="h-8 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] transition-colors"
            :class="activeTab === tab.id ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:text-ink'"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>
      </div>

      <section v-show="activeTab === 'google'" class="p-4 sm:p-5">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="font-semibold text-[15px]">Google 搜索</h2>
          <span class="chip">第三方中转</span>
        </div>
        <p class="text-[12.5px] text-ink2 mt-1">经第三方中转抓取结果并在站内渲染，支持 SearXNG JSON、Google Custom Search API 以及可解析的 HTML 搜索页。</p>

        <div class="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="googleForm.enabled" type="checkbox" class="w-4 h-4 accent-current" />
            启用 Google 站内搜索
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="googleForm.safeSearch" type="checkbox" class="w-4 h-4 accent-current" />
            安全搜索
          </label>
        </div>

        <div class="grid sm:grid-cols-2 gap-3.5 mt-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">结果语言</span>
            <input v-model="googleForm.language" type="text" class="field" placeholder="zh-CN" maxlength="16" spellcheck="false" />
            <span class="text-[11.5px] text-ink3">形如 zh-CN、en，会作为 hl/language 参数传给中转。</span>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">每页结果数</span>
            <input v-model.number="googleForm.pageSize" type="number" min="10" max="30" class="field" />
            <span class="text-[11.5px] text-ink3">范围 10-30，默认 10。</span>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">最大页数</span>
            <input v-model.number="googleForm.maxPages" type="number" min="1" max="10" class="field" />
            <span class="text-[11.5px] text-ink3">范围 1-10，受第三方接口分页上限约束。</span>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">搜索缓存</span>
            <div class="flex items-center gap-2">
              <input v-model.number="googleForm.cacheSec" type="number" min="60" max="3600" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">秒</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">单次中转超时</span>
            <div class="flex items-center gap-2">
              <input v-model.number="googleForm.timeoutMs" type="number" min="2000" max="15000" step="500" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">毫秒</span>
            </div>
          </label>
        </div>

        <div class="mt-5 border-t border-line pt-4">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p class="text-[13px] font-semibold">中转线路</p>
              <p class="mt-0.5 text-[11.5px] text-ink2">按顺序尝试，最多 6 个；可用性测试会优先把可用线路排到前面。</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-sm btn-ghost" :disabled="testingGoogleRelays" @click="testGoogleRelays">{{ testingGoogleRelays ? '测试中…' : '测试线路' }}</button>
              <button type="button" class="btn btn-sm btn-ghost" @click="resetGoogleRelays">恢复默认</button>
              <button type="button" class="btn btn-sm btn-ghost" :disabled="googleForm.relays.length >= 6" @click="addGoogleRelay">添加线路</button>
            </div>
          </div>

          <div v-if="googleForm.relays.length" class="mt-3 space-y-2">
            <div v-for="(relay, index) in googleForm.relays" :key="index" class="flex items-center gap-2">
              <span class="w-5 shrink-0 text-center text-[11px] tabular-nums text-ink3">{{ index + 1 }}</span>
              <input
                v-model="googleForm.relays[index]"
                type="text"
                class="field min-w-0 flex-1 text-[12.5px]"
                :aria-label="`Google 中转线路 ${index + 1}`"
                placeholder="https://searx.example.com 或 https://www.googleapis.com/customsearch/v1?key=...&cx=...&q=%s"
                spellcheck="false"
                autocomplete="off"
              />
              <button type="button" class="btn btn-sm btn-ghost !px-2" :disabled="index === 0" aria-label="上移" @click="moveGoogleRelay(index, -1)">↑</button>
              <button type="button" class="btn btn-sm btn-ghost !px-2" :disabled="index === googleForm.relays.length - 1" aria-label="下移" @click="moveGoogleRelay(index, 1)">↓</button>
              <button type="button" class="btn btn-sm btn-ghost !px-2 text-danger" aria-label="移除" @click="removeGoogleRelay(index)">×</button>
            </div>
          </div>
          <p v-else class="mt-3 rounded-lg border border-dashed border-line px-3 py-2 text-[11.5px] text-ink3">
            当前未配置。可填入 SearXNG 站点根地址（自动按 JSON 接口请求），或带 <code class="px-1 rounded bg-card2">%s</code> 的完整地址模板。
          </p>
          <div v-if="googleRelayHealthList.length" class="mt-3 flex flex-wrap items-center gap-1.5">
            <span
              v-for="row in googleRelayHealthList"
              :key="row.url"
              class="inline-flex items-center h-[22px] px-2 rounded-md bg-card text-[11px]"
              :class="row.ok ? 'text-ink' : 'text-ink3'"
              :title="row.ok ? `${row.url} 响应 ${row.ms}ms，命中 ${row.items} 条` : `${row.url} 请求失败（HTTP ${row.status || 0}）`"
            >
              <i class="w-1.5 h-1.5 rounded-full mr-1.5" :class="row.ok ? 'bg-success' : 'bg-ink3'" />
              {{ relayHost(row.url) }} · {{ row.ok ? `${row.ms}ms` : '失败' }}
            </span>
          </div>
          <div class="mt-3 space-y-1 text-[11px] leading-relaxed text-ink3">
            <p>模板占位符：<code class="px-1 rounded bg-card2">%s</code> 关键词、<code class="px-1 rounded bg-card2">%pageno%</code> 页码、<code class="px-1 rounded bg-card2">%start%</code> 起始偏移、<code class="px-1 rounded bg-card2">%lang%</code> 语言。</p>
            <p>示例：搜尋引擎根地址 <span class="text-ink2">https://searx.example.com</span>；Google CSE <span class="text-ink2">https://www.googleapis.com/customsearch/v1?key=KEY&amp;cx=CX&amp;q=%s&amp;start=%start%&amp;num=10</span>。</p>
            <p>线路地址可能含密钥，前台只展示域名，不会回显完整地址。</p>
          </div>
        </div>
      </section>

      <section v-show="activeTab === 'search'" class="p-4 sm:p-5">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="font-semibold text-[15px]">GitHub 搜索</h2>
          <span class="chip">站内搜索引擎</span>
        </div>
        <p class="text-[12.5px] text-ink2 mt-1">关闭后 GitHub 搜索与项目页将不可访问。</p>

        <div class="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.enabled" type="checkbox" class="w-4 h-4 accent-current" />
            启用 GitHub 搜索
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.showReadme" type="checkbox" class="w-4 h-4 accent-current" />
            展示 README
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.showIssues" type="checkbox" class="w-4 h-4 accent-current" />
            Issues
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.showPulls" type="checkbox" class="w-4 h-4 accent-current" />
            Pull requests
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.showReleases" type="checkbox" class="w-4 h-4 accent-current" />
            Releases
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.showCommits" type="checkbox" class="w-4 h-4 accent-current" />
            Commits
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.showContributors" type="checkbox" class="w-4 h-4 accent-current" />
            贡献者
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.showRefs" type="checkbox" class="w-4 h-4 accent-current" />
            分支与标签
          </label>
        </div>

        <div class="grid sm:grid-cols-2 gap-3.5 mt-5">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">默认排序</span>
            <select v-model="form.defaultSort" class="field cursor-pointer">
              <option value="best">最佳匹配</option>
              <option value="stars">Star 最多</option>
              <option value="forks">Fork 最多</option>
              <option value="updated">最近更新</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">每页结果数</span>
            <input v-model.number="form.pageSize" type="number" min="10" max="30" class="field" />
            <span class="text-[11.5px] text-ink3">范围 10-30，默认 20。</span>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">最大页数</span>
            <input v-model.number="form.maxPages" type="number" min="1" max="20" class="field" />
            <span class="text-[11.5px] text-ink3">范围 1-20，受 GitHub 搜索接口上限约束。</span>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">搜索缓存</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.searchCacheSec" type="number" min="60" max="3600" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">秒</span>
            </div>
          </label>
        </div>

      </section>

      <section v-show="activeTab === 'source'" class="p-4 sm:p-5">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="font-semibold text-[15px]">数据源</h2>
          <span class="chip">中转优先</span>
        </div>
        <p class="text-[12.5px] text-ink2 mt-1">搜索与项目页 JSON 请求优先走第三方中转，全部失败后才回退 GitHub 官方接口。</p>
        <div class="mt-3 rounded-xl border border-line bg-card2 p-3.5">
          <label class="flex items-start gap-2.5 text-[13.5px]">
            <input v-model="form.searchFallback" type="checkbox" class="mt-0.5 w-4 h-4 accent-current" />
            <span>
              优先使用第三方中转，失败后回退 GitHub 官方接口
              <span class="mt-1 block text-[11.5px] font-normal leading-relaxed text-ink2">
                中转通常有多个出口 IP，会优先承载搜索与项目页 JSON 请求。关闭后将直接请求官方接口，服务器 IP 的匿名额度仅 60 次/小时。
              </span>
            </span>
          </label>

          <div class="mt-4 border-t border-line pt-3">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p class="text-[13px] font-semibold">第三方中转线路</p>
                <p class="mt-0.5 text-[11.5px] text-ink2">按顺序尝试，最多 6 个；用于搜索及项目页 JSON 接口。</p>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="btn btn-sm btn-ghost" :disabled="testingRelays" @click="testRelays">{{ testingRelays ? '测试中…' : '测试线路' }}</button>
                <button type="button" class="btn btn-sm btn-ghost" @click="resetRelays">恢复默认</button>
                <button type="button" class="btn btn-sm btn-ghost" :disabled="form.searchRelays.length >= 6" @click="addRelay">添加线路</button>
              </div>
            </div>

            <div v-if="form.searchRelays.length" class="mt-3 space-y-2">
              <div v-for="(relay, index) in form.searchRelays" :key="index" class="flex items-center gap-2">
                <span class="w-5 shrink-0 text-center text-[11px] tabular-nums text-ink3">{{ index + 1 }}</span>
                <input
                  v-model="form.searchRelays[index]"
                  type="text"
                  class="field min-w-0 flex-1 text-[12.5px]"
                  :aria-label="`中转线路 ${index + 1}`"
                  placeholder="https://example.com"
                  spellcheck="false"
                  autocomplete="off"
                />
                <button type="button" class="btn btn-sm btn-ghost !px-2" :disabled="index === 0" aria-label="上移" @click="moveRelay(index, -1)">↑</button>
                <button type="button" class="btn btn-sm btn-ghost !px-2" :disabled="index === form.searchRelays.length - 1" aria-label="下移" @click="moveRelay(index, 1)">↓</button>
                <button type="button" class="btn btn-sm btn-ghost !px-2 text-danger" aria-label="移除" @click="removeRelay(index)">×</button>
              </div>
            </div>
            <p v-else class="mt-3 rounded-lg border border-dashed border-line px-3 py-2 text-[11.5px] text-ink3">
              当前未配置，将回退到服务端 GITHUB_SEARCH_RELAYS 或内置线路。
            </p>
            <div v-if="relayHealthList.length" class="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                v-for="row in relayHealthList"
                :key="row.url"
                class="inline-flex items-center h-[22px] px-2 rounded-md bg-card text-[11px]"
                :class="row.ok ? 'text-ink' : 'text-ink3'"
                :title="row.ok ? `${row.url} 响应 ${row.ms}ms` : `${row.url} 请求失败`"
              >
                <i class="w-1.5 h-1.5 rounded-full mr-1.5" :class="row.ok ? 'bg-success' : 'bg-ink3'" />
                {{ relayHost(row.url) }} · {{ row.ok ? `${row.ms}ms` : '失败' }}
              </span>
            </div>
            <p class="mt-2 text-[11px] text-ink3">搜索会优先使用可用且延迟低的线路，全部失败后再回退官方接口。</p>
          </div>
        </div>

      </section>

      <section v-show="activeTab === 'content'" class="p-4 sm:p-5">
        <h2 class="font-semibold text-[15px]">项目页内容</h2>
        <p class="text-[12.5px] text-ink2 mt-1">限制 README 与文件预览大小，并设置内容缓存时间。</p>
        <div class="mt-3 grid sm:grid-cols-2 gap-3.5">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">README 大小上限</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.readmeMaxKB" type="number" min="32" max="512" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">KB</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">文件预览上限</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.filePreviewMaxKB" type="number" min="64" max="2048" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">KB</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">仓库与内容缓存</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.repoCacheSec" type="number" min="60" max="3600" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">秒</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">README 缓存</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.readmeCacheSec" type="number" min="60" max="3600" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">秒</span>
            </div>
          </label>
        </div>

      </section>

      <section v-show="activeTab === 'download'" class="p-4 sm:p-5">
        <h2 class="font-semibold text-[15px]">下载代理</h2>
        <p class="text-[12.5px] text-ink2 mt-1">控制源码 ZIP 与 Release 附件的下载开关及大小限制。</p>
        <div class="mt-3 flex flex-wrap gap-x-6 gap-y-3">
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.enableZip" type="checkbox" class="w-4 h-4 accent-current" />
            允许源码 ZIP
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.enableReleaseDownload" type="checkbox" class="w-4 h-4 accent-current" />
            允许 Release 附件
          </label>
        </div>
        <div class="grid sm:grid-cols-3 gap-3.5 mt-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">源码 ZIP 上限</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.maxZipMB" type="number" min="10" max="1024" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">MB</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">Release 附件上限</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.maxAssetMB" type="number" min="10" max="2048" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">MB</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">原文件上限</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.rawMaxMB" type="number" min="1" max="100" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">MB</span>
            </div>
          </label>
        </div>

      </section>

      <section v-show="activeTab === 'image'" class="p-4 sm:p-5">
        <h2 class="font-semibold text-[15px]">图片防盗链</h2>
        <p class="mt-1 text-[12px] text-ink2">README 与头像图片统一走本站签名代理，仅允许本站页面或白名单来源加载，避免被用作图片 CDN。</p>
        <div class="mt-3 flex flex-wrap gap-x-6 gap-y-3">
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.antiHotlink" type="checkbox" class="w-4 h-4 accent-current" />
            启用签名与 Referer 校验
          </label>
          <label class="flex items-center gap-2 text-[13.5px]">
            <input v-model="form.allowEmptyReferer" type="checkbox" class="w-4 h-4 accent-current" />
            允许空 Referer
          </label>
        </div>
        <div class="grid sm:grid-cols-3 gap-3.5 mt-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">资源链接有效期</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.assetTtlSec" type="number" min="60" max="3600" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">秒</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">图片大小上限</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.imageMaxMB" type="number" min="1" max="50" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">MB</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">图片限流</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.imageRatePerMin" type="number" min="10" max="300" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">次/分</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-3">
            <span class="text-[13px] font-medium">Referer 白名单</span>
            <textarea v-model="form.refererWhitelist" class="field !h-20 py-2.5 resize-y leading-6" maxlength="500" placeholder="example.com, cdn.example.com" />
            <span class="text-[11.5px] text-ink3">每行或逗号分隔，支持子域名；本站域名始终允许。允许空 Referer 会削弱防盗链效果。</span>
          </label>
        </div>
      </section>

      <div class="p-4 sm:px-5 sm:py-4 border-t border-line flex items-center justify-end gap-2">
        <span v-if="msg" class="text-[12.5px] mr-auto" :class="msgKind === 'err' ? 'text-danger' : 'text-ink2'">{{ msg }}</span>
        <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存设置' }}</button>
      </div>
    </form>
  </div>
</template>
