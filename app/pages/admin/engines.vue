<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { DEFAULT_GITHUB_SEARCH_RELAYS, DEFAULT_SITE_SETTINGS, normalizeSiteSettings, type GithubSettings } from '#shared/siteSettings'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const form = reactive<GithubSettings>({ ...DEFAULT_SITE_SETTINGS.github })
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const msgKind = ref<'ok' | 'err'>('ok')

const tabs = [
  { id: 'search', label: '搜索' },
  { id: 'source', label: '数据源' },
  { id: 'content', label: '项目页' },
  { id: 'download', label: '下载' },
  { id: 'image', label: '图片' }
] as const
const activeTab = ref<typeof tabs[number]['id']>('search')

useSeoMeta({ title: '引擎设置 · 2077 管理后台', robots: 'noindex' })

function flash(text: string, kind: 'ok' | 'err' = 'ok') {
  msg.value = text
  msgKind.value = kind
  setTimeout(() => { if (msg.value === text) msg.value = '' }, kind === 'err' ? 4800 : 2200)
}

function apply(raw: any) {
  Object.assign(form, normalizeSiteSettings({ ...DEFAULT_SITE_SETTINGS, github: raw }).github)
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
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '配置读取失败', 'err')
  } finally {
    loading.value = false
  }
})

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
  saving.value = true
  try {
    const relays = form.searchRelays.map(value => value.trim()).filter(Boolean)
    const data: any = await $fetch('/api/admin/engine-settings', {
      method: 'PUT',
      body: { github: { ...form, searchRelays: relays } }
    })
    apply(data?.github)
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
        管理 GitHub 搜索的开关、数据源、内容展示与下载限制。保存后前台约 15 秒内生效。
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
