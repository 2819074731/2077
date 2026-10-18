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
  http_status?: number | null
  final_url?: string
  checked_at?: string | null
}

const items = ref<Entry[]>([])
const total = ref(0)
const published = ref(0)
const tdkMissing = ref(0)
const linkBroken = ref(0)
const categories = ref<any[]>([])
const siteCategories = ref<string[]>([])
const page = ref(1)
const kw = ref('')
const category = ref('')
const status = ref('')
const missingOnly = ref(false)
const brokenOnly = ref(false)
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
const tdkRunning = ref(false)
const linkRunning = ref(false)
const pushRunning = ref(false)
const maintainRunning = ref(false)
const maintenance = ref<any>(null)
const tdkScope = ref<'all' | 'category' | 'batch'>('all')
const tdkCategory = ref('')
const tdkBatchSize = ref(6)
const tdkProgress = ref('')
const tdkOpen = ref(false)
const opsOpen = ref(false)
const linkProgress = ref('')
const tdkModes: Array<{ v: 'all' | 'category' | 'batch'; l: string }> = [
  { v: 'all', l: '全部' },
  { v: 'category', l: '按分类' },
  { v: 'batch', l: '指定数量' }
]
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
    if (missingOnly.value) qs.set('missing', '1')
    if (brokenOnly.value) qs.set('broken', '1')
    if (from.value) qs.set('from', from.value)
    if (to.value) qs.set('to', to.value)
    const d: any = await $fetch(`/api/admin/directory?${qs}`)
    items.value = d.items || []
    total.value = d.total || 0
    published.value = d.published || 0
    tdkMissing.value = Number(d.tdkMissing || 0)
    linkBroken.value = Number(d.linkBroken || 0)
    categories.value = d.categories || []
    maintenance.value = d.maintenance || null
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
  missingOnly.value = false
  brokenOnly.value = false
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

function fmtTime(value?: string | null) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

async function maintainNow() {
  if (maintainRunning.value) return
  maintainRunning.value = true
  try {
    const d: any = await $fetch('/api/admin/maintenance', { method: 'POST' })
    const r = d.record || {}
    const broken = Number(r.link?.broken || 0)
    showToast(`巡检完成：检查 ${Number(r.link?.checked || 0)} 个链接，异常 ${broken} 个；TDK 更新 ${Number(r.tdk?.updated || 0)} 个`, broken ? 'err' : 'ok')
    await load()
  } catch (e: any) {
    showToast(e?.data?.statusMessage || e?.data?.message || '巡检失败', 'err')
  } finally {
    maintainRunning.value = false
  }
}

async function batchTdk() {
  if (tdkRunning.value) return
  if (tdkScope.value === 'category' && !tdkCategory.value) {
    showToast('请选择要补全的分类', 'err')
    return
  }
  tdkRunning.value = true
  tdkProgress.value = ''
  let updated = 0
  let failed = 0
  let missing = 0
  let processed = 0
  const loop = tdkScope.value !== 'batch'
  const maxRounds = loop ? 500 : 1
  try {
    for (let i = 0; i < maxRounds; i++) {
      const body: any = {
        scope: tdkScope.value,
        limit: tdkScope.value === 'batch' ? tdkBatchSize.value : 6,
        reset: i === 0
      }
      if (tdkScope.value === 'category') body.category = tdkCategory.value
      const d: any = await $fetch('/api/admin/directory/tdk', { method: 'POST', body })
      updated += Number(d.updated || 0)
      failed += Number(d.failed || 0)
      missing = Number(d.missing || 0)
      processed += Number(d.processed || 0)
      tdkProgress.value = `已处理 ${processed} 个，更新 ${updated} 个，剩余 ${Number(d.remaining || 0)} 个`
      if (!d.processed || Number(d.remaining || 0) === 0) break
    }
    const tail = missing ? `，仍有 ${missing} 个站点 TDK 不完整（多受站点防护限制）` : ''
    const scopeText = tdkScope.value === 'category' ? `「${tdkCategory.value}」分类` : tdkScope.value === 'batch' ? `指定 ${tdkBatchSize.value} 个` : '全部缺失'
    showToast(`${scopeText}补全完成：处理 ${processed} 个，更新 ${updated} 个${failed ? `，失败 ${failed} 个` : ''}${tail}`, failed ? 'err' : 'ok')
    await load()
  } catch (err: any) {
    showToast(err?.data?.statusMessage || err?.data?.message || '批量补全失败', 'err')
  } finally {
    tdkRunning.value = false
  }
}

function openTdk() {
  tdkScope.value = 'all'
  tdkCategory.value = category.value || ''
  tdkProgress.value = ''
  tdkOpen.value = true
}

function openOps() {
  linkProgress.value = ''
  opsOpen.value = true
}

async function pushSearch() {
  if (pushRunning.value) return
  pushRunning.value = true
  try {
    const d: any = await $fetch('/api/admin/seo/push', { method: 'POST', body: { scope: 'all' } })
    const ix = d.indexnow || {}
    const bd = d.baidu || {}
    const ixText = ix.ok ? 'IndexNow 成功' : ix.skipped ? 'IndexNow 跳过' : `IndexNow 失败${ix.status ? `(${ix.status})` : ''}`
    const bdText = bd.ok ? `百度成功 ${Number(bd.pushed || 0)} 条` : bd.skipped ? '百度未配置 token' : `百度失败${bd.status ? `(${bd.status})` : ''}`
    showToast(`已推送 ${Number(d.count || 0)} 个 URL：${ixText}；${bdText}`, ix.ok ? 'ok' : 'err')
  } catch (err: any) {
    showToast(err?.data?.statusMessage || err?.data?.message || '推送失败', 'err')
  } finally {
    pushRunning.value = false
  }
}

async function checkLinks() {
  if (linkRunning.value) return
  linkRunning.value = true
  linkProgress.value = '准备巡检…'
  let checked = 0
  let broken = 0
  try {
    for (let i = 0; i < 40; i++) {
      const d: any = await $fetch('/api/admin/directory/check-links', { method: 'POST', body: { limit: 8 } })
      checked += Number(d.checked || 0)
      broken += Number(d.broken || 0)
      linkProgress.value = `已检查 ${checked} 个，异常 ${broken} 个，待检 ${Number(d.remaining || 0)} 个`
      if (!d.checked || Number(d.remaining || 0) === 0) break
    }
    showToast(`链接巡检完成：检查 ${checked} 个${broken ? `，异常 ${broken} 个` : ''}`, broken ? 'err' : 'ok')
    await load()
  } catch (err: any) {
    linkProgress.value = err?.data?.statusMessage || err?.data?.message || '链接巡检失败'
    showToast(linkProgress.value, 'err')
  } finally {
    linkRunning.value = false
  }
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
    if (action === 'featured') body.featured = e.featured ? 0 : 1
    await $fetch('/api/admin/directory', { method: 'POST', body })
    flash(action === 'delete' ? '已删除' : action === 'featured' ? (e.featured ? '已取消推荐' : '已设为推荐') : '状态已更新')
    await load()
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.data?.message || '操作失败')
  }
}

function tdkIssues(e: Entry) {
  const out: string[] = []
  if (!String(e.title || '').trim()) out.push('缺标题')
  if (!String(e.description || '').trim()) out.push('缺描述')
  if (!String(e.keywords || '').trim()) out.push('缺关键词')
  return out
}

function onMenuToggle(ev: Event) {
  const el = ev.currentTarget as HTMLDetailsElement | null
  if (!el?.open) return
  document.querySelectorAll<HTMLDetailsElement>('details.row-menu[open]').forEach((d) => {
    if (d !== el) d.removeAttribute('open')
  })
}

function closeRowMenu(ev: Event) {
  const el = (ev.currentTarget as HTMLElement | null)?.closest('details')
  if (el) el.removeAttribute('open')
}

function iconOf(url: string) {
  try { return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}` } catch { return '' }
}

const modalOpen = computed(() => !!(editing.value || tdkOpen.value || opsOpen.value))

watch(modalOpen, (v) => {
  if (!import.meta.client) return
  document.documentElement.style.overflow = v ? 'hidden' : ''
  document.body.style.overflow = v ? 'hidden' : ''
})

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (editing.value) editing.value = null
  else if (tdkOpen.value) tdkOpen.value = false
  else if (opsOpen.value) opsOpen.value = false
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
      <div class="card p-3 flex flex-col gap-2.5">
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
          <button class="btn btn-sm" :class="missingOnly ? 'btn-primary' : 'btn-ghost'" @click="missingOnly = !missingOnly; brokenOnly = false; search()">
            缺 TDK <span class="opacity-70">{{ tdkMissing }}</span>
          </button>
          <button class="btn btn-sm" :class="brokenOnly ? 'btn-primary' : 'btn-ghost'" @click="brokenOnly = !brokenOnly; missingOnly = false; search()">
            链接异常 <span class="opacity-70">{{ linkBroken }}</span>
          </button>
          <span class="text-[12.5px] text-ink2 sm:ml-auto">共 {{ total }} 个 · 已发布 {{ published }}</span>
        </div>
        <form class="flex flex-wrap items-center gap-2" @submit.prevent="search">
          <input v-model="kw" class="field grow min-w-[180px] sm:max-w-[320px]" placeholder="搜索名称、网址或简介" />
          <button class="btn btn-sm shrink-0" type="submit">搜索</button>
          <details class="relative shrink-0">
            <summary class="btn btn-sm btn-ghost list-none cursor-pointer select-none">日期筛选</summary>
            <div class="mt-2 flex flex-wrap items-center gap-2 sm:absolute sm:right-0 sm:top-full sm:z-20 sm:mt-2 sm:rounded-xl sm:border sm:border-line sm:bg-card sm:p-3 sm:shadow-soft">
              <input v-model="from" type="date" class="field !w-auto" aria-label="开始日期" />
              <span class="text-[12px] text-ink3">至</span>
              <input v-model="to" type="date" class="field !w-auto" aria-label="结束日期" />
              <button class="btn btn-sm" type="submit">应用</button>
            </div>
          </details>
          <button v-if="kw || category || status || missingOnly || brokenOnly || from || to" type="button" class="btn btn-sm btn-ghost shrink-0" @click="resetFilters">重置</button>
          <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button type="button" class="btn btn-sm" @click="openTdk">
              TDK 补全
              <span class="text-[11px]" :class="tdkMissing ? 'text-warning' : 'text-ink3'">{{ tdkMissing }}</span>
            </button>
            <button type="button" class="btn btn-sm" @click="openOps">巡检与推送</button>
            <button type="button" class="btn btn-sm btn-primary" @click="openCreate">新增站点</button>
          </div>
        </form>
      </div>

      <p v-if="missingOnly" class="text-[12px] text-warning">当前只显示缺 TDK 的 {{ total }} 个站点，点「TDK 补全」统一处理。</p>
      <p v-else-if="brokenOnly" class="text-[12px] text-warning">当前只显示链接异常的站点，行内显示返回的 HTTP 状态码。</p>
      <p v-if="msg" class="text-[13px] text-ink2">{{ msg }}</p>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">
      {{ missingOnly ? '当前没有缺 TDK 的站点。' : brokenOnly ? '当前没有链接异常的站点。' : '暂无目录站点，点击「新增站点」或到「链接发现」批量导入。' }}
    </div>
    <template v-else>
      <div class="flex flex-wrap items-center gap-2 px-1 mb-2">
        <label class="flex items-center gap-2 text-[12.5px] text-ink2 cursor-pointer">
          <input type="checkbox" class="w-4 h-4 accent-current" :checked="allSelected" @change="toggleAll" />
          本页全选
        </label>
        <span class="text-[12.5px] text-ink2">已选 {{ selected.size }} 个</span>
        <div class="flex-1" />
        <button class="btn btn-sm btn-primary" :disabled="!selected.size || bulkActing" @click="bulk('publish')">批量发布</button>
        <button class="btn btn-sm btn-ghost" :disabled="!selected.size || bulkActing" @click="bulk('hide')">批量隐藏</button>
      </div>
      <div class="card divide-y divide-line">
        <div v-for="e in items" :key="e.id" class="flex items-start gap-2.5 px-3 py-2.5 first:rounded-t-2xl last:rounded-b-2xl hover:bg-card2/40">
          <input
            type="checkbox"
            class="w-4 h-4 mt-1 shrink-0 accent-current"
            :checked="selected.has(Number(e.id))"
            :aria-label="`选择 ${e.name}`"
            @change="toggleSelect(Number(e.id))"
          />
          <SiteIcon :src="e.icon || iconOf(e.url)" :name="e.name" :url="e.url" class="w-8 h-8 rounded-lg shrink-0 text-[12px]" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <button class="font-medium text-[13.5px] text-left hover:underline" title="编辑站点" @click="openEdit(e)">{{ e.name }}</button>
              <span class="chip !text-[10px]">{{ e.category }}</span>
              <span v-if="e.featured" class="chip !text-[10px]">推荐</span>
              <span v-if="e.status !== 'published'" class="chip !text-[10px]">已隐藏</span>
              <span v-if="!e.detail_enabled" class="chip !text-[10px]">无详情页</span>
              <span v-for="b in tdkIssues(e)" :key="b" class="chip !text-[10px] text-warning">{{ b }}</span>
              <span v-if="e.http_status && e.http_status >= 400" class="chip !text-[10px] text-danger" :title="`HTTP ${e.http_status} · ${fmtTime(e.checked_at)}`">HTTP {{ e.http_status }}</span>
            </div>
            <a :href="e.url" target="_blank" rel="noopener" :title="e.url" class="mt-0.5 block text-[11.5px] text-ink3 truncate hover:text-ink">{{ e.url }}</a>
          </div>
          <button v-if="missingOnly" class="btn btn-sm shrink-0" @click="openEdit(e)">编辑</button>
          <details class="relative shrink-0 row-menu" @toggle="onMenuToggle">
            <summary class="btn btn-sm btn-ghost btn-icon-sm list-none cursor-pointer" aria-label="更多操作">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
            </summary>
            <div class="absolute right-0 top-full z-30 mt-1 w-32 rounded-xl border border-line bg-card p-1 shadow-soft">
              <NuxtLink v-if="e.detail_enabled" :to="`/site/${e.id}.html`" target="_blank" class="flex items-center h-8 px-2.5 rounded-lg text-[12.5px] text-ink2 hover:bg-card2" @click="closeRowMenu">查看详情</NuxtLink>
              <a v-else :href="e.url" target="_blank" rel="noopener" class="flex items-center h-8 px-2.5 rounded-lg text-[12.5px] text-ink2 hover:bg-card2" @click="closeRowMenu">访问官网</a>
              <button class="flex items-center w-full h-8 px-2.5 rounded-lg text-[12.5px] text-ink2 hover:bg-card2" @click="closeRowMenu($event); openEdit(e)">编辑</button>
              <button class="flex items-center w-full h-8 px-2.5 rounded-lg text-[12.5px] text-ink2 hover:bg-card2" @click="closeRowMenu($event); act(e, 'status')">{{ e.status === 'published' ? '隐藏' : '发布' }}</button>
              <button class="flex items-center w-full h-8 px-2.5 rounded-lg text-[12.5px] text-ink2 hover:bg-card2" @click="closeRowMenu($event); act(e, 'featured')">{{ e.featured ? '取消推荐' : '设为推荐' }}</button>
              <button class="flex items-center w-full h-8 px-2.5 rounded-lg text-[12.5px] text-danger hover:bg-card2" @click="closeRowMenu($event); act(e, 'delete')">删除</button>
            </div>
          </details>
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

    <div v-if="tdkOpen" role="dialog" aria-modal="true" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="tdkOpen = false" />
      <div class="relative w-full sm:max-w-[540px] max-h-[92dvh] flex flex-col bg-card border-t sm:border border-line rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div class="shrink-0 flex items-center gap-2 px-4 h-14 border-b border-line">
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-[15px]">TDK 补全</h2>
            <p class="text-[11px] text-ink3">标题、描述、关键词任一为空即视为缺失</p>
          </div>
          <button class="btn btn-sm btn-ghost btn-icon-sm" aria-label="关闭" @click="tdkOpen = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          <p class="text-[13px] text-ink2">当前缺 TDK <span class="font-semibold" :class="tdkMissing ? 'text-warning' : 'text-success'">{{ tdkMissing }}</span> 个。</p>
          <div>
            <p class="text-[12px] text-ink2 mb-1.5">补全范围</p>
            <div class="flex gap-1 p-1 rounded-xl bg-card2 border border-line">
              <button
                v-for="m in tdkModes"
                :key="m.v"
                class="flex-1 h-8 rounded-lg text-[12.5px] whitespace-nowrap transition-colors"
                :class="tdkScope === m.v ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:text-ink'"
                :disabled="tdkRunning"
                @click="tdkScope = m.v"
              >{{ m.l }}</button>
            </div>
          </div>
          <select v-if="tdkScope === 'category'" v-model="tdkCategory" class="field" :disabled="tdkRunning">
            <option value="">选择分类</option>
            <option v-for="c in filterCategories" :key="c.category" :value="c.category">{{ c.category }}（{{ c.n }}）</option>
          </select>
          <label v-if="tdkScope === 'batch'" class="flex items-center gap-2 text-[12.5px] text-ink2">
            每批处理
            <input v-model.number="tdkBatchSize" type="number" min="1" max="50" class="field !w-20" :disabled="tdkRunning" />
            个
          </label>
          <div v-if="tdkProgress" class="rounded-xl border border-line bg-bg px-3 py-2.5 text-[12px] text-ink2">{{ tdkProgress }}</div>
          <p class="text-[11.5px] text-ink3">补全会访问官网抓取标题、描述与关键词。受站点防护限制抓不到时，请到列表中逐条编辑。</p>
        </div>
        <div class="shrink-0 flex gap-2 px-4 py-3 border-t border-line pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          <button class="btn btn-primary flex-1" :disabled="tdkRunning || (tdkScope === 'category' && !tdkCategory)" @click="batchTdk">{{ tdkRunning ? '补全中…' : '开始补全' }}</button>
          <button class="btn flex-1" @click="tdkOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <div v-if="opsOpen" role="dialog" aria-modal="true" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="opsOpen = false" />
      <div class="relative w-full sm:max-w-[560px] max-h-[92dvh] flex flex-col bg-card border-t sm:border border-line rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div class="shrink-0 flex items-center gap-2 px-4 h-14 border-b border-line">
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-[15px]">巡检与推送</h2>
            <p class="text-[11px] text-ink3">自动巡检每日 {{ maintenance?.schedule || '04:10' }}{{ maintenance?.last ? ` · 最近 ${fmtTime(maintenance.last.at)}` : ' · 尚未运行' }}</p>
          </div>
          <button class="btn btn-sm btn-ghost btn-icon-sm" aria-label="关闭" @click="opsOpen = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          <div class="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-ink2">
            <span>TDK 缺失 <b :class="tdkMissing ? 'text-warning' : 'text-success'">{{ tdkMissing }}</b></span>
            <span>链接异常 <b :class="linkBroken ? 'text-warning' : 'text-success'">{{ linkBroken }}</b></span>
            <span>待检链接 <b>{{ maintenance?.dueLinks || 0 }}</b></span>
          </div>
          <div class="rounded-xl border border-line divide-y divide-line">
            <div class="flex items-center gap-3 p-3">
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-medium">全量巡检</p>
                <p class="text-[11.5px] text-ink3">检查到期链接并补全缺失 TDK</p>
              </div>
              <button class="btn btn-sm btn-primary shrink-0" :disabled="maintainRunning || linkRunning || pushRunning" @click="maintainNow">{{ maintainRunning ? '巡检中…' : '立即执行' }}</button>
            </div>
            <div class="flex items-center gap-3 p-3">
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-medium">链接巡检</p>
                <p class="text-[11.5px] text-ink3">逐条访问官网，记录异常状态码</p>
              </div>
              <button class="btn btn-sm shrink-0" :disabled="maintainRunning || linkRunning || pushRunning" @click="checkLinks">{{ linkRunning ? '巡检中…' : '开始巡检' }}</button>
            </div>
            <div class="flex items-center gap-3 p-3">
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-medium">搜索推送</p>
                <p class="text-[11.5px] text-ink3">向 IndexNow 与百度提交已发布页面</p>
              </div>
              <button class="btn btn-sm shrink-0" :disabled="maintainRunning || linkRunning || pushRunning" @click="pushSearch">{{ pushRunning ? '推送中…' : '开始推送' }}</button>
            </div>
          </div>
          <div v-if="linkProgress" class="rounded-xl border border-line bg-bg px-3 py-2.5 text-[12px] text-ink2">{{ linkProgress }}</div>
          <p class="text-[11.5px] text-ink3">任务在后台执行，可关闭弹窗，完成后右下角会显示结果。</p>
        </div>
        <div class="shrink-0 flex gap-2 px-4 py-3 border-t border-line pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          <button class="btn flex-1" @click="opsOpen = false">关闭</button>
        </div>
      </div>
    </div>

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
