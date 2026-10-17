<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Entry {
  id?: number
  name: string
  url: string
  icon: string
  category: string
  title: string
  description: string
  keywords: string
  content: string
  featured: number
  sort: number
  status: string
  detail_enabled?: number
}

const items = ref<Entry[]>([])
const total = ref(0)
const published = ref(0)
const categories = ref<any[]>([])
const siteCategories = ref<string[]>([])
const page = ref(1)
const kw = ref('')
const category = ref('')
const status = ref('')
const from = ref('')
const to = ref('')
const selected = ref<Set<number>>(new Set())
const bulkActing = ref(false)
const toast = ref('')
const toastKind = ref<'ok' | 'err'>('ok')
let toastTimer: ReturnType<typeof setTimeout> | null = null
const loading = ref(false)
const msg = ref('')
const size = 20

const editing = ref<Entry | null>(null)
const saving = ref(false)
const metaFetching = ref(false)
const formError = ref('')

useSeoMeta({ title: '分类目录 · 2077 管理后台', robots: 'noindex' })

const categoryOptions = computed(() => {
  const seen = new Set<string>(siteCategories.value)
  const extra = categories.value.map((c: any) => String(c.category)).filter((c) => c && !seen.has(c))
  return [...siteCategories.value, ...extra]
})

const filterCategories = computed(() => categories.value.filter((c: any) => Number(c.n) > 0))
const allSelected = computed(() => items.value.length > 0 && items.value.every((item) => selected.value.has(Number(item.id))))

const emptyEntry = (): Entry => ({
  name: '', url: '', icon: '', category: '其他', title: '', description: '',
  keywords: '', content: '', featured: 0, sort: 0, status: 'published', detail_enabled: 1
})

async function loadCategories() {
  try {
    const d: any = await $fetch('/api/categories')
    siteCategories.value = d.categories || []
  } catch {}
}

async function load() {
  loading.value = true
  try {
    const qs = new URLSearchParams({ page: String(page.value), size: String(size) })
    if (kw.value.trim()) qs.set('q', kw.value.trim())
    if (category.value) qs.set('category', category.value)
    if (status.value) qs.set('status', status.value)
    if (from.value) qs.set('from', from.value)
    if (to.value) qs.set('to', to.value)
    const d: any = await $fetch(`/api/admin/directory?${qs}`)
    items.value = d.items || []
    total.value = d.total || 0
    published.value = d.published || 0
    categories.value = d.categories || []
    selected.value = new Set()
  } finally {
    loading.value = false
  }
}

function search() { page.value = 1; load() }
function go(p: number) { page.value = p; load() }
function flash(text: string) {
  msg.value = text
  setTimeout(() => (msg.value = ''), 1600)
}

function showToast(text: string, kind: 'ok' | 'err' = 'ok') {
  toast.value = text
  toastKind.value = kind
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4800)
}

function resetFilters() {
  kw.value = ''
  category.value = ''
  status.value = ''
  from.value = ''
  to.value = ''
  search()
}

function toggleSelect(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(items.value.map((item) => Number(item.id)))
}

async function bulk(op: 'publish' | 'hide') {
  if (bulkActing.value || !selected.value.size) return
  const ids = [...selected.value]
  const label = op === 'publish' ? '发布' : '隐藏'
  if (!confirm(`确定${label}所选 ${ids.length} 个站点？`)) return
  bulkActing.value = true
  try {
    const d: any = await $fetch('/api/admin/directory', {
      method: 'POST',
      body: { action: 'bulk', ids, op }
    })
    const parts = [`更新 ${d.updated} 个`]
    if (d.skipped) parts.push(`跳过 ${d.skipped} 个`)
    if (d.errors) parts.push(`失败 ${d.errors} 个`)
    showToast(`批量${label}完成：${parts.join('，')}`, d.errors ? 'err' : 'ok')
    await load()
  } catch (err: any) {
    showToast(err?.data?.statusMessage || err?.data?.message || '批量操作失败', 'err')
  } finally {
    bulkActing.value = false
  }
}

async function fetchTkd() {
  const e = editing.value
  if (!e || metaFetching.value) return
  if (!e.url.trim()) { formError.value = '请先填写网址'; return }
  if ((e.title || e.description || e.keywords) && !confirm('将覆盖现有 TDK，继续获取？')) return
  metaFetching.value = true
  formError.value = ''
  try {
    const d: any = await $fetch('/api/meta', { method: 'POST', body: { url: e.url } })
    const m = d.meta || {}
    if (m.title) {
      e.title = m.title
      if (!e.name.trim()) e.name = (m.title.split(/[-_|·—]/)[0].trim() || m.title).slice(0, 80)
    }
    if (m.description) e.description = m.description
    if (m.keywords) e.keywords = m.keywords
    if (m.icon) e.icon = `/api/icon?url=${encodeURIComponent(m.host)}`
    else if (!e.icon.trim()) e.icon = iconOf(e.url)
    flash('已获取 TDK 与图标')
  } catch (err: any) {
    formError.value = err?.data?.statusMessage || err?.data?.message || '抓取失败，请手动填写'
  } finally {
    metaFetching.value = false
  }
}

function openCreate() {
  editing.value = emptyEntry()
  formError.value = ''
}

function openEdit(e: Entry) {
  editing.value = { ...e, content: e.content || '' }
  formError.value = ''
}

async function save() {
  const e = editing.value
  if (!e || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    await $fetch('/api/admin/directory', {
      method: 'POST',
      body: { id: e.id || 0, entry: { ...e, featured: e.featured ? 1 : 0 } }
    })
    editing.value = null
    flash(e.id ? '已更新' : '已新增')
    await load()
  } catch (err: any) {
    formError.value = err?.data?.statusMessage || err?.data?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function act(e: Entry, action: string) {
  if (action === 'delete' && !confirm(`确定删除「${e.name}」？该操作不可撤销。`)) return
  try {
    const body: any = { action, id: e.id }
    if (action === 'status') body.status = e.status === 'published' ? 'hidden' : 'published'
    await $fetch('/api/admin/directory', { method: 'POST', body })
    flash(action === 'delete' ? '已删除' : '状态已更新')
    await load()
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.data?.message || '操作失败')
  }
}

function iconOf(url: string) {
  try { return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}` } catch { return '' }
}

watch(editing, (v) => {
  if (!import.meta.client) return
  document.documentElement.style.overflow = v ? 'hidden' : ''
  document.body.style.overflow = v ? 'hidden' : ''
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') editing.value = null
}

onMounted(async () => {
  await loadCategories()
  await load()
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (toastTimer) clearTimeout(toastTimer)
  if (import.meta.client) {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex flex-col gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex gap-1 p-1 rounded-xl bg-card2 border border-line overflow-x-auto">
          <button
            v-for="f in [{ v: '', l: '全部' }, { v: 'published', l: '已发布' }, { v: 'hidden', l: '已隐藏' }]"
            :key="f.v"
            class="h-8 px-3 rounded-lg text-[12.5px] whitespace-nowrap transition-colors"
            :class="status === f.v ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:text-ink'"
            @click="status = f.v; search()"
          >{{ f.l }}</button>
        </div>
        <select v-model="category" class="field !w-auto max-w-[180px]" @change="search">
          <option value="">全部分类</option>
          <option v-for="c in filterCategories" :key="c.category" :value="c.category">{{ c.category }}（{{ c.n }}）</option>
        </select>
        <span class="text-[12.5px] text-ink2 ml-auto">共 {{ total }} 个 · 已发布 {{ published }}</span>
        <button class="btn btn-sm btn-primary" @click="openCreate">新增站点</button>
      </div>
      <form class="flex flex-wrap gap-2" @submit.prevent="search">
        <input v-model="kw" class="field grow sm:max-w-[280px]" placeholder="搜索名称、网址或简介" />
        <input v-model="from" type="date" class="field !w-auto" aria-label="开始日期" />
        <span class="self-center text-[12px] text-ink3">至</span>
        <input v-model="to" type="date" class="field !w-auto" aria-label="结束日期" />
        <button class="btn shrink-0" type="submit">搜索</button>
        <button v-if="kw || category || status || from || to" type="button" class="btn btn-ghost shrink-0" @click="resetFilters">重置</button>
      </form>
      <p v-if="msg" class="text-[13px] text-ink2">{{ msg }}</p>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">
      暂无目录站点，点击「新增站点」或到「链接发现」批量导入。
    </div>
    <template v-else>
      <div class="card p-3 flex flex-wrap items-center gap-2 mb-3">
        <label class="flex items-center gap-2 text-[12.5px] text-ink2 cursor-pointer">
          <input type="checkbox" class="w-4 h-4 accent-current" :checked="allSelected" @change="toggleAll" />
          本页全选
        </label>
        <span class="text-[12.5px] text-ink2">已选 {{ selected.size }} 个</span>
        <div class="flex-1" />
        <button class="btn btn-sm btn-primary" :disabled="!selected.size || bulkActing" @click="bulk('publish')">批量发布</button>
        <button class="btn btn-sm btn-ghost" :disabled="!selected.size || bulkActing" @click="bulk('hide')">批量隐藏</button>
      </div>
      <div class="card overflow-hidden divide-y divide-line">
        <div v-for="e in items" :key="e.id" class="p-3.5 sm:p-4">
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              class="w-4 h-4 mt-1 shrink-0 accent-current"
              :checked="selected.has(Number(e.id))"
              :aria-label="`选择 ${e.name}`"
              @change="toggleSelect(Number(e.id))"
            />
            <SiteIcon :src="e.icon || iconOf(e.url)" :name="e.name" :url="e.url" class="w-9 h-9 rounded-lg shrink-0 text-[13px]" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-medium text-[13.5px]">{{ e.name }}</span>
                <span class="chip !text-[10px]">{{ e.category }}</span>
                <span v-if="e.featured" class="chip !text-[10px]">推荐</span>
                <span class="chip !text-[10px]" :class="{ 'text-success': e.status === 'published' }">{{ e.status === 'published' ? '已发布' : '已隐藏' }}</span>
                <span v-if="!e.detail_enabled" class="chip !text-[10px]">无详情页</span>
              </div>
              <a :href="e.url" target="_blank" rel="noopener" class="block text-[11.5px] text-ink2 truncate hover:text-ink">{{ e.url }}</a>
              <p v-if="e.description" class="text-[11.5px] text-ink3 mt-0.5 line-clamp-1">{{ e.description }}</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
            <NuxtLink v-if="e.detail_enabled" :to="`/site/${e.id}.html`" target="_blank" class="btn btn-sm btn-ghost">查看详情</NuxtLink>
            <a v-else :href="e.url" target="_blank" rel="noopener" class="btn btn-sm btn-ghost">访问官网</a>
            <button class="btn btn-sm" @click="openEdit(e)">编辑</button>
            <button class="btn btn-sm btn-ghost" @click="act(e, 'status')">{{ e.status === 'published' ? '隐藏' : '发布' }}</button>
            <div class="flex-1" />
            <button class="btn btn-sm btn-ghost text-danger" @click="act(e, 'delete')">删除</button>
          </div>
        </div>
      </div>
    </template>

    <AdminPager :page="page" :total="total" :size="size" @change="go" />

    <Teleport to="body">
      <div
        v-if="toast"
        class="fixed left-1/2 bottom-6 z-[80] w-[calc(100%-2rem)] max-w-[520px] -translate-x-1/2 rounded-xl border bg-bg px-4 py-3 text-[12.5px] shadow-soft"
        :class="toastKind === 'err' ? 'border-danger text-danger' : 'border-line text-success'"
        role="status"
      >{{ toast }}</div>
    </Teleport>

    <div v-if="editing" role="dialog" aria-modal="true" class="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="editing = null" />
      <div class="relative w-full h-[100dvh] sm:h-auto sm:max-w-[720px] sm:max-h-[90vh] flex flex-col bg-card border-line sm:border sm:rounded-2xl shadow-xl overflow-hidden">
        <div class="shrink-0 flex items-center gap-2 px-4 h-14 border-b border-line bg-card">
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-[15px] truncate">{{ editing.id ? '编辑目录站点' : '新增目录站点' }}</h2>
            <p class="text-[11px] text-ink3">{{ editing.id ? '修改后保存即可生效' : '带 * 的为必填项' }}</p>
          </div>
          <button class="btn btn-sm btn-ghost btn-icon-sm" aria-label="关闭" @click="editing = null">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <form class="flex-1 min-h-0 flex flex-col" @submit.prevent="save">
          <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            <section class="flex flex-col gap-3">
              <h3 class="text-[12px] font-semibold text-ink3 uppercase tracking-wider">基础信息</h3>
              <div class="grid sm:grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-[12px] text-ink2">站点名称 *</span>
                  <input v-model="editing.name" class="field" placeholder="例如 2077 导航" required maxlength="100" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-[12px] text-ink2">网址 *</span>
                  <input v-model="editing.url" class="field" placeholder="https://example.com" required inputmode="url" autocapitalize="off" spellcheck="false" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-[12px] text-ink2">分类</span>
                  <select v-model="editing.category" class="field">
                    <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
                  </select>
                </label>
                <div class="flex flex-col gap-1">
                  <span class="text-[12px] text-ink2">图标地址（留空自动抓取）</span>
                  <div class="flex items-center gap-2">
                    <SiteIcon :src="editing.icon || iconOf(editing.url)" :name="editing.name" :url="editing.url" class="w-9 h-9 rounded-lg shrink-0 text-[13px]" />
                    <input v-model="editing.icon" class="field flex-1 min-w-0" placeholder="/api/icon?url=..." />
                  </div>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-3 pt-1">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-[12px] font-semibold text-ink3 uppercase tracking-wider">SEO 与描述</h3>
                <button type="button" class="btn btn-sm btn-ghost" :disabled="metaFetching" @click="fetchTkd">
                  <svg v-if="!metaFetching" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                  {{ metaFetching ? '抓取中…' : '一键获取 TKD' }}
                </button>
              </div>
              <label class="flex flex-col gap-1">
                <span class="text-[12px] text-ink2">SEO 标题（留空使用站点名称）</span>
                <input v-model="editing.title" class="field" placeholder="不超过 200 字" maxlength="200" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-[12px] text-ink2">简介（用于列表与搜索描述）</span>
                <textarea v-model="editing.description" class="field !h-20 py-2 resize-y" placeholder="一两句话介绍该站点" maxlength="500" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-[12px] text-ink2">关键词（逗号分隔）</span>
                <input v-model="editing.keywords" class="field" placeholder="导航,工具,资源" maxlength="200" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-[12px] text-ink2">详情页正文（可选，支持换行）</span>
                <textarea v-model="editing.content" class="field !h-28 py-2 resize-y" placeholder="补充介绍、使用说明等，将展示在详情页" />
              </label>
            </section>

            <section class="flex flex-col gap-3 pt-1">
              <h3 class="text-[12px] font-semibold text-ink3 uppercase tracking-wider">展示设置</h3>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <label class="flex flex-col gap-1">
                  <span class="text-[12px] text-ink2">排序</span>
                  <input v-model.number="editing.sort" type="number" min="0" max="9999" class="field" inputmode="numeric" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-[12px] text-ink2">状态</span>
                  <select v-model="editing.status" class="field">
                    <option value="published">已发布</option>
                    <option value="hidden">已隐藏</option>
                  </select>
                </label>
                <label class="flex items-center gap-2 h-10 px-1">
                  <input v-model="editing.featured" type="checkbox" :true-value="1" :false-value="0" class="w-4 h-4 accent-current" />
                  <span class="text-[12.5px] text-ink2">设为推荐</span>
                </label>
                <label class="flex items-center gap-2 h-10 px-1">
                  <input v-model="editing.detail_enabled" type="checkbox" :true-value="1" :false-value="0" class="w-4 h-4 accent-current" />
                  <span class="text-[12.5px] text-ink2">启用详情页</span>
                </label>
              </div>
            </section>

            <p v-if="formError" class="text-[12.5px] text-danger">{{ formError }}</p>
          </div>

          <div class="shrink-0 flex gap-2 px-4 py-3 sm:py-4 border-t border-line bg-card pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
            <button class="btn btn-primary flex-1 sm:flex-none sm:min-w-[120px]" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
            <button class="btn flex-1 sm:flex-none" type="button" @click="editing = null">取消</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
