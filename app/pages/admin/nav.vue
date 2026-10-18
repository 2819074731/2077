<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { iconFor, hostOf } from '~/data/nav'
import { parseBookmarksHtml } from '#shared/bookmarks'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ALink { name: string; url: string; icon?: string; category?: string; recommended?: boolean }
interface NavLink extends ALink { category: string }
interface HealthInfo { status: number; checkedAt: string }

const links = ref<NavLink[]>([])
const categories = ref<string[]>([])
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const msgKind = ref<'ok' | 'err'>('ok')
const fileInput = ref<HTMLInputElement | null>(null)
const bookmarkInput = ref<HTMLInputElement | null>(null)
const fetching = ref('')
const bulkBusy = ref(false)
const bulkDone = ref(0)
const bulkTotal = ref(0)
const health = ref<Record<string, HealthInfo>>({})
const checking = ref(false)
const checkDone = ref(0)
const checkTotal = ref(0)

const category = ref('')
const kw = ref('')
const page = ref(1)
const PAGE_SIZE = 20
const snapshot = ref('')

interface LinkEditor {
  mode: 'new' | 'edit'
  draft: ALink
  original?: NavLink
  indexAtOpen: number
}
const linkEditor = ref<LinkEditor | null>(null)

useSeoMeta({ title: '导航管理 · 2077 管理后台', robots: 'noindex' })

function flash(text: string, kind: 'ok' | 'err' = 'ok') {
  msg.value = text
  msgKind.value = kind
  if (kind === 'ok') setTimeout(() => { if (msg.value === text) msg.value = '' }, 2600)
}

function normalizeKey(url: string): string {
  try {
    const u = new URL(String(url || '').trim())
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function normalizeUrl(input: string): string {
  let s = String(input || '').trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    return /^https?:$/.test(u.protocol) ? u.toString() : ''
  } catch {
    return ''
  }
}

function hideImg(e: Event) {
  const el = e.target as HTMLImageElement
  if (el) el.style.visibility = 'hidden'
}
function healthOf(l: ALink): HealthInfo | undefined {
  return health.value[normalizeKey(l.url)]
}
function healthText(l: ALink): string {
  const h = healthOf(l)
  if (!h) return ''
  const when = h.checkedAt ? new Date(h.checkedAt).toLocaleString('zh-CN', { hour12: false }) : ''
  return `${h.status ? 'HTTP ' + h.status : '无法访问'} · ${when}`
}

const categoryOptions = computed(() => {
  const seen = new Set(categories.value)
  const extras = links.value.map((l) => l.category).filter((c) => c && !seen.has(c))
  return [...categories.value, ...Array.from(new Set(extras))]
})

const navCounts = computed(() => {
  const map = new Map<string, number>()
  for (const l of links.value) map.set(l.category, (map.get(l.category) || 0) + 1)
  return map
})

const navDuplicateKeys = computed(() => {
  const counts = new Map<string, number>()
  for (const l of links.value) {
    const k = normalizeKey(l.url)
    if (!k) continue
    const id = `${l.category}\u0000${k}`
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  return new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([id]) => id))
})
const recommendedLinks = computed(() => links.value.filter(l => l.recommended))
const duplicateCount = computed(() =>
  links.value.filter(l => navDuplicateKeys.value.has(`${l.category}\u0000${normalizeKey(l.url)}`)).length
)
const invalidCount = computed(() =>
  links.value.filter(l => !l.name.trim() || !/^https?:\/\//i.test(l.url.trim())).length
)
const dirty = computed(() => JSON.stringify(links.value) !== snapshot.value)

const filtered = computed(() => {
  const keyword = kw.value.trim().toLowerCase()
  return links.value.filter((l) => {
    if (category.value && l.category !== category.value) return false
    if (!keyword) return true
    return l.name.toLowerCase().includes(keyword) || l.url.toLowerCase().includes(keyword)
  })
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

watch([category, kw], () => { page.value = 1 })
watch(pages, (n) => { if (page.value > n) page.value = n })

function isDup(l: ALink) {
  return navDuplicateKeys.value.has(`${l.category}\u0000${normalizeKey(l.url)}`)
}
const editorDup = computed(() => {
  const ed = linkEditor.value
  if (!ed) return false
  const key = normalizeKey(ed.draft.url)
  if (!key) return false
  const pool = links.value.filter((l) => l.category === (ed.draft.category || '其他'))
  return pool.some(l => l !== ed.original && normalizeKey(l.url) === key)
})

function cleanTitle(title: string): string {
  return String(title || '').split(/[-_|·—]/)[0].trim().slice(0, 48)
}
function applyMeta(l: ALink, meta: any) {
  if (!l.name && (meta?.title || meta?.host)) l.name = cleanTitle(meta.title) || String(meta.host || '')
  if (meta?.host) l.icon = `/api/icon?url=${encodeURIComponent(meta.host)}`
  else if (l.url) l.icon = iconFor(l.url)
}
async function fetchMeta(l: ALink) {
  const key = normalizeUrl(l.url)
  if (!key || fetching.value) return
  l.url = key
  fetching.value = key
  try {
    const d: any = await $fetch('/api/meta', { method: 'POST', body: { url: key } })
    applyMeta(l, d.meta)
    flash('已抓取站点信息')
  } catch (e: any) {
    flash(e?.data?.statusMessage || '抓取失败', 'err')
  } finally {
    fetching.value = ''
  }
}
async function fetchMetaSilent(l: ALink) {
  try {
    const d: any = await $fetch('/api/meta', { method: 'POST', body: { url: l.url } })
    applyMeta(l, d.meta)
  } catch {}
}

function insertAtCategoryEnd(link: NavLink) {
  let last = -1
  links.value.forEach((item, i) => { if (item.category === link.category) last = i })
  if (last >= 0) links.value.splice(last + 1, 0, link)
  else links.value.push(link)
}
function moveLink(link: NavLink, dir: number) {
  const peers = links.value.filter((l) => l.category === link.category)
  const peerIndex = peers.indexOf(link)
  const target = peers[peerIndex + dir]
  if (!target) return
  const a = links.value.indexOf(link)
  const b = links.value.indexOf(target)
  if (a < 0 || b < 0) return
  links.value.splice(a, 1)
  links.value.splice(b, 0, link)
}
function openNew() {
  const cat = category.value || categoryOptions.value[0] || '其他'
  linkEditor.value = {
    mode: 'new',
    draft: { name: '', url: '', category: cat },
    indexAtOpen: -1
  }
}
function openEdit(l: ALink) {
  linkEditor.value = {
    mode: 'edit',
    draft: { ...(l as NavLink) },
    original: l as NavLink,
    indexAtOpen: links.value.indexOf(l as NavLink)
  }
}
function toggleRecommended(l: ALink) {
  l.recommended = !l.recommended
}
function closeLinkEditor() {
  linkEditor.value = null
}
function saveLinkEditor() {
  const ed = linkEditor.value
  if (!ed) return
  const name = ed.draft.name.trim()
  const url = normalizeUrl(ed.draft.url) || ed.draft.url.trim()
  if (!name) { flash('请填写站点名称', 'err'); return }
  if (!/^https?:\/\//i.test(url)) { flash('请填写有效网址', 'err'); return }
  const icon = ed.draft.icon || iconFor(url)
  const next: NavLink = { name, url, icon, category: ed.draft.category || '其他', recommended: !!ed.draft.recommended }
  if (ed.mode === 'new') {
    insertAtCategoryEnd(next)
    page.value = 1
  } else if (ed.original) {
    const oldCategory = ed.original.category
    Object.assign(ed.original, next)
    if (oldCategory !== next.category) {
      const i = links.value.indexOf(ed.original)
      if (i >= 0) links.value.splice(i, 1)
      insertAtCategoryEnd(ed.original)
    }
  }
  linkEditor.value = null
  flash('已修改，点击「保存全部」后生效')
}
function editorMove(dir: number) {
  const ed = linkEditor.value
  if (!ed || ed.mode !== 'edit' || !ed.original) return
  moveLink(ed.original as NavLink, dir)
}
function editorDelete() {
  const ed = linkEditor.value
  if (!ed || ed.mode !== 'edit' || !ed.original) return
  const label = ed.draft.name || hostOf(ed.draft.url) || '该站点'
  if (!confirm(`确定删除「${label}」？保存全部后生效。`)) return
  const i = links.value.indexOf(ed.original as NavLink)
  if (i >= 0) links.value.splice(i, 1)
  linkEditor.value = null
  flash('已删除，保存全部后生效')
}
function editorFetch() {
  if (linkEditor.value) fetchMeta(linkEditor.value.draft)
}

async function loadHealth() {
  try {
    const d: any = await $fetch('/api/admin/health')
    const map: Record<string, HealthInfo> = {}
    for (const it of d.items || []) {
      const k = normalizeKey(it.url)
      if (k) map[k] = { status: Number(it.status || 0), checkedAt: it.checkedAt }
    }
    health.value = map
  } catch {}
}

function applyData(groups: any[], rec: any[]) {
  const recKeys = new Set((rec || []).map((l: any) => normalizeKey(String(l?.url || ''))).filter(Boolean))
  links.value = []
  for (const g of groups || []) {
    for (const l of g.links || []) {
      links.value.push({
        name: l.name,
        url: l.url,
        icon: l.icon || '',
        category: String(g.name || '其他'),
        recommended: recKeys.has(normalizeKey(l.url))
      })
    }
  }
  snapshot.value = JSON.stringify(links.value)
}

async function load() {
  loading.value = true
  try {
    const [d, c]: any[] = await Promise.all([
      $fetch('/api/admin/nav'),
      $fetch('/api/categories').catch(() => ({ categories: [] }))
    ])
    categories.value = c.categories || []
    applyData(d.groups || [], d.recommended || [])
    loadHealth()
  } finally {
    loading.value = false
  }
}

async function save() {
  if (invalidCount.value) {
    flash(`有 ${invalidCount.value} 条链接缺少名称或网址无效`, 'err')
    return false
  }
  if (duplicateCount.value) {
    flash(`有 ${duplicateCount.value} 条重复网址，请先处理`, 'err')
    return false
  }
  saving.value = true
  try {
    const order = categoryOptions.value
    const groups = order
      .map((name) => ({
        name,
        links: links.value
          .filter((l) => l.category === name)
          .map((l) => ({ name: l.name, url: normalizeUrl(l.url), icon: l.icon || iconFor(l.url) }))
      }))
      .filter((g) => g.links.length)
    const payloadRec = links.value
      .filter(l => l.recommended)
      .map(l => ({ name: l.name, url: normalizeUrl(l.url), icon: l.icon || iconFor(l.url) }))
    const d: any = await $fetch('/api/admin/nav', {
      method: 'PUT',
      body: { groups, recommended: payloadRec }
    })
    applyData(d.groups || [], d.recommended || [])
    const synced = Number(d.sync?.created || 0)
    if (d.syncError) flash(`已保存，目录同步失败：${d.syncError}`, 'err')
    else flash(synced ? `已保存，并新增 ${synced} 个目录站点` : '已保存并同步到前台')
    return true
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '保存失败', 'err')
    return false
  } finally {
    saving.value = false
  }
}

function exportJson() {
  window.open('/api/admin/nav/export', '_blank')
}

async function importJson(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    const d: any = await $fetch('/api/admin/nav/import', { method: 'POST', body: { data } })
    applyData(d.groups, d.recommended)
    flash('已导入 JSON')
    await loadHealth()
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.message || '导入失败', 'err')
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function importBookmarks(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const folders = parseBookmarksHtml(text)
    const totalCount = folders.reduce((n, f) => n + f.links.length, 0)
    if (!totalCount) { flash('未识别到书签，请确认是浏览器导出的 HTML 文件', 'err'); return }
    if (!confirm(`识别到 ${totalCount} 个书签（${folders.length} 个文件夹），按文件夹导入并立即保存？`)) return
    let added = 0
    let mapped = 0
    const known = new Set(categories.value)
    const fallbackCategory = category.value || '其他'
    const seen = new Set(links.value.map((x) => normalizeKey(x.url)))
    for (const f of folders) {
      const categoryName = known.has(f.folder) ? f.folder : fallbackCategory
      if (f.folder && !known.has(f.folder)) mapped++
      for (const l of f.links) {
        const k = normalizeKey(l.url)
        if (!k || seen.has(k)) continue
        seen.add(k)
        links.value.push({
          name: l.name || hostOf(l.url),
          url: l.url,
          icon: iconFor(l.url),
          category: categoryName
        })
        added++
      }
    }
    if (!added) { flash('没有新增书签（均已存在）'); return }
    const ok = await save()
    const note = mapped ? `，${mapped} 个文件夹已归入「${fallbackCategory}」` : ''
    flash(ok ? `已导入并保存 ${added} 个书签${note}` : `已导入 ${added} 个书签${note}，请手动保存`, ok ? 'ok' : 'err')
  } catch (err: any) {
    flash(err?.message || '书签解析失败', 'err')
  }
}

async function bulkFill(list: ALink[]) {
  if (bulkBusy.value) return
  bulkBusy.value = true
  let iconFixed = 0
  for (const l of list) {
    if (/^https?:\/\//i.test(l.url) && !l.icon) {
      l.icon = iconFor(l.url)
      iconFixed++
    }
  }
  const targets = list.filter(l => /^https?:\/\//i.test(l.url) && !l.name)
  if (!targets.length) {
    bulkBusy.value = false
    flash(iconFixed ? `已补全 ${iconFixed} 个图标` : '没有需要补全的链接')
    return
  }
  bulkTotal.value = targets.length
  bulkDone.value = 0
  let cursor = 0
  const workers = Array.from({ length: 3 }, async () => {
    while (cursor < targets.length) {
      const l = targets[cursor++]
      await fetchMetaSilent(l)
      bulkDone.value++
    }
  })
  await Promise.all(workers)
  bulkBusy.value = false
  flash(`已补全 ${iconFixed} 个图标，抓取 ${targets.length} 条名称`)
}

async function checkLinks(list: ALink[]) {
  if (checking.value) return
  const seen = new Set<string>()
  const urls: string[] = []
  for (const l of list) {
    const raw = l.url.trim()
    if (!/^https?:\/\//i.test(raw)) continue
    const k = normalizeKey(raw)
    if (!k || seen.has(k)) continue
    seen.add(k)
    urls.push(raw)
  }
  if (!urls.length) { flash('没有可巡检的网址', 'err'); return }
  checking.value = true
  checkTotal.value = urls.length
  checkDone.value = 0
  try {
    for (let i = 0; i < urls.length; i += 18) {
      const batch = urls.slice(i, i + 18)
      const d: any = await $fetch('/api/admin/health/check', { method: 'POST', body: { urls: batch } })
      for (const it of d.items || []) {
        const k = normalizeKey(it.url)
        if (k) health.value[k] = { status: Number(it.status || 0), checkedAt: new Date().toISOString() }
      }
      checkDone.value = Math.min(i + batch.length, urls.length)
    }
    flash('巡检完成', 'ok')
  } catch (e: any) {
    flash(e?.data?.statusMessage || '巡检失败', 'err')
  } finally {
    checking.value = false
  }
}

watch(linkEditor, (v) => {
  if (!import.meta.client) return
  document.documentElement.style.overflow = v ? 'hidden' : ''
  document.body.style.overflow = v ? 'hidden' : ''
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && linkEditor.value) closeLinkEditor()
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (import.meta.client) {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <div class="animate-fade-up pb-16 lg:pb-0">
    <div class="flex flex-col gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="category" class="field !w-auto max-w-[180px]">
          <option value="">全部分类</option>
          <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}（{{ navCounts.get(c) || 0 }}）</option>
        </select>
        <span v-if="dirty" class="chip !text-[10px] text-warning">有未保存修改</span>
        <span class="text-[12.5px] text-ink2 ml-auto">{{ categoryOptions.length }} 个分类 · {{ links.length }} 条导航 · {{ recommendedLinks.length }} 条推荐</span>
        <button class="btn btn-sm btn-primary" @click="openNew">添加站点</button>
      </div>
      <form class="flex gap-2" @submit.prevent="page = 1">
        <input v-model="kw" class="field grow sm:max-w-[320px]" placeholder="搜索名称或网址" />
        <button class="btn shrink-0" type="submit">搜索</button>
        <button v-if="kw || category" type="button" class="btn btn-ghost shrink-0" @click="kw = ''; category = ''">重置</button>
      </form>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-sm" @click="bookmarkInput?.click()">导入书签</button>
        <button class="btn btn-sm" @click="fileInput?.click()">导入 JSON</button>
        <button class="btn btn-sm" @click="exportJson">导出 JSON</button>
        <button class="btn btn-sm" :disabled="bulkBusy" @click="bulkFill(filtered)">{{ bulkBusy ? `补全中 ${bulkDone}/${bulkTotal}` : '补全名称/图标' }}</button>
        <button class="btn btn-sm" :disabled="checking" @click="checkLinks(filtered)">{{ checking ? `巡检 ${checkDone}/${checkTotal}` : '巡检当前列表' }}</button>
        <span v-if="duplicateCount" class="text-[12px] text-warning">{{ duplicateCount }} 条重复网址</span>
        <span v-if="invalidCount" class="text-[12px] text-danger">{{ invalidCount }} 条待补全</span>
        <div class="flex-1" />
        <button class="btn btn-sm btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存全部' }}</button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importJson" />
        <input ref="bookmarkInput" type="file" accept="text/html,.html,.htm" class="hidden" @change="importBookmarks" />
      </div>
      <p v-if="msg" class="text-[12.5px]" :class="msgKind === 'err' ? 'text-danger' : 'text-success'">{{ msg }}</p>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!filtered.length" class="card p-8 text-center text-ink2 text-[13px]">
      当前分类暂无导航站点，点击「添加站点」开始。
    </div>
    <div v-else class="card overflow-hidden divide-y divide-line">
      <div v-for="l in paged" :key="l" class="p-3.5 sm:p-4">
        <div class="flex items-start gap-3">
          <span class="grid place-items-center w-9 h-9 rounded-lg border border-line bg-card shrink-0 overflow-hidden">
            <img v-if="l.url" :src="l.icon || iconFor(l.url)" alt="" class="w-5 h-5 object-contain" loading="lazy" referrerpolicy="no-referrer" @error="hideImg" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-medium text-[13.5px]" :class="!l.name && 'text-ink3'">{{ l.name || '未命名站点' }}</span>
              <span v-if="l.category" class="chip !text-[10px]">{{ l.category }}</span>
              <span v-if="l.recommended" class="chip !text-[10px]">推荐</span>
              <span v-if="isDup(l)" class="chip !text-[10px] text-warning">重复</span>
              <span v-if="healthOf(l)" class="w-1.5 h-1.5 rounded-full shrink-0" :class="healthOf(l)!.status && healthOf(l)!.status < 400 ? 'bg-success' : 'bg-danger'" :title="healthText(l)" />
            </div>
            <a :href="l.url" target="_blank" rel="noopener" class="block text-[11.5px] text-ink2 truncate hover:text-ink">{{ l.url || '未填写网址' }}</a>
            <p v-if="healthText(l)" class="text-[11px] text-ink3 mt-0.5">{{ healthText(l) }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
          <button class="btn btn-sm" @click="openEdit(l)">编辑</button>
          <a :href="l.url" target="_blank" rel="noopener" class="btn btn-sm btn-ghost">访问网站</a>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost" :class="l.recommended && '!text-ink'" @click="toggleRecommended(l)">
            {{ l.recommended ? '取消推荐' : '设为推荐' }}
          </button>
          <button class="btn btn-sm btn-ghost" @click="openEdit(l)">调整顺序</button>
        </div>
      </div>
    </div>

    <AdminPager :page="page" :total="filtered.length" :size="PAGE_SIZE" @change="page = $event" />

    <div v-if="linkEditor" class="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="closeLinkEditor" />
      <div class="relative w-full h-[100dvh] sm:h-auto sm:max-w-[520px] sm:max-h-[90vh] flex flex-col bg-card border-line sm:border sm:rounded-2xl shadow-xl overflow-hidden">
        <div class="shrink-0 flex items-center gap-2 px-4 h-14 border-b border-line bg-card">
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-[15px] truncate">
              {{ linkEditor.mode === 'new' ? '添加站点' : '编辑导航站点' }}
            </h2>
            <p class="text-[11px] text-ink3 truncate">{{ linkEditor.draft.category }} · 修改后点「保存全部」生效</p>
          </div>
          <button type="button" class="btn btn-sm btn-ghost btn-icon-sm" aria-label="关闭" @click="closeLinkEditor">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <form class="flex-1 min-h-0 flex flex-col" @submit.prevent="saveLinkEditor">
          <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <span class="grid place-items-center w-11 h-11 rounded-xl border border-line bg-card shrink-0 overflow-hidden">
                <img v-if="linkEditor.draft.url" :src="linkEditor.draft.icon || iconFor(linkEditor.draft.url)" alt="" class="w-6 h-6 object-contain" referrerpolicy="no-referrer" @error="hideImg" />
                <span v-else class="text-[15px] font-bold text-ink3">{{ (linkEditor.draft.name || '?').slice(0, 1).toUpperCase() }}</span>
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-medium truncate">{{ linkEditor.draft.name || '未命名站点' }}</p>
                <p class="text-[11px] text-ink3 truncate">{{ linkEditor.draft.url || '未填写网址' }}</p>
              </div>
            </div>

            <label class="flex flex-col gap-1.5">
              <span class="text-[12px] text-ink2">站点名称 *</span>
              <input v-model="linkEditor.draft.name" class="field" placeholder="例如 GitHub" maxlength="60" autofocus />
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-[12px] text-ink2">网址 *</span>
              <input v-model="linkEditor.draft.url" class="field" placeholder="https://..." inputmode="url" />
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-[12px] text-ink2">分类</span>
              <select v-model="linkEditor.draft.category" class="field">
                <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-[12px] text-ink2">图标地址（可选，留空自动获取）</span>
              <input v-model="linkEditor.draft.icon" class="field" placeholder="https://.../icon.png" />
            </label>

            <label class="flex items-center gap-2.5 rounded-xl border border-line bg-card2 px-3 py-2.5 cursor-pointer">
              <input v-model="linkEditor.draft.recommended" type="checkbox" class="w-4 h-4 accent-current" />
              <span class="min-w-0">
                <span class="block text-[12.5px] text-ink">设为推荐</span>
                <span class="block text-[11px] text-ink3 mt-0.5">在该分类内置顶展示，并标记「荐」</span>
              </span>
            </label>

            <p v-if="editorDup" class="text-[11.5px] text-warning">该网址与其他导航站点重复</p>
            <p v-if="healthText(linkEditor.draft)" class="text-[11.5px] text-ink3">{{ healthText(linkEditor.draft) }}</p>

            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <button type="button" class="btn btn-sm" :disabled="!!fetching || !linkEditor.draft.url" @click="editorFetch">
                {{ fetching ? '抓取中…' : '抓取站点信息' }}
              </button>
              <div class="flex-1" />
              <button type="button" class="btn btn-sm btn-ghost" :disabled="linkEditor.mode === 'new'" @click="editorMove(-1)">上移</button>
              <button type="button" class="btn btn-sm btn-ghost" :disabled="linkEditor.mode === 'new'" @click="editorMove(1)">下移</button>
              <button v-if="linkEditor.mode === 'edit'" type="button" class="btn btn-sm btn-ghost text-danger" @click="editorDelete">删除</button>
            </div>
          </div>

          <div class="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-line bg-card pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
            <button type="button" class="btn flex-1 sm:flex-none" @click="closeLinkEditor">取消</button>
            <button type="submit" class="btn btn-primary flex-1 sm:flex-none">保存</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="dirty" class="lg:hidden fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-line bg-header/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
      <span class="text-[12px] text-warning flex-1">有未保存修改</span>
      <button class="btn btn-sm btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存全部' }}</button>
    </div>
  </div>
</template>
