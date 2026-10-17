<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { iconFor, hostOf } from '~/data/nav'
import { parseBookmarksHtml } from '#shared/bookmarks'
import { SITE_CATEGORIES } from '#shared/categories'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ALink { name: string; url: string; icon?: string }
interface AGroup { name: string; links: ALink[]; recommended?: boolean }
interface HealthInfo { status: number; checkedAt: string }

const groups = ref<AGroup[]>([])
const recommended = ref<ALink[]>([])
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

const view = ref<'group' | 'recommended'>('group')
const activeGroup = ref(0)
const groupKw = ref('')
const linkKw = ref('')
const page = ref(1)
const PAGE_SIZE = 20
const snapshot = ref('')

interface LinkEditor {
  draft: ALink
  original: ALink
  list: ALink[]
  groupName: string
  kind: 'group' | 'recommended'
  isNew: boolean
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

const allLinks = computed(() => [...groups.value.flatMap(g => g.links), ...recommended.value])
function keysWithDuplicates(list: ALink[]): Set<string> {
  const counts = new Map<string, number>()
  for (const l of list) {
    const k = normalizeKey(l.url)
    if (!k) continue
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  return new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([k]) => k))
}
const groupLinks = computed(() => groups.value.flatMap(g => g.links))
const duplicateKeys = computed(() => keysWithDuplicates(groupLinks.value))
const recDuplicateKeys = computed(() => keysWithDuplicates(recommended.value))
const duplicateCount = computed(() =>
  groupLinks.value.filter(l => duplicateKeys.value.has(normalizeKey(l.url))).length
  + recommended.value.filter(l => recDuplicateKeys.value.has(normalizeKey(l.url))).length
)
const invalidCount = computed(() => allLinks.value.filter(l => !l.name.trim() || !/^https?:\/\//i.test(l.url.trim())).length)
const dirty = computed(() => JSON.stringify({ groups: groups.value, recommended: recommended.value }) !== snapshot.value)

const active = computed<AGroup | null>(() => groups.value[activeGroup.value] || null)
const filteredGroups = computed(() => {
  const kw = groupKw.value.trim().toLowerCase()
  if (!kw) return groups.value.map((g, i) => ({ g, i }))
  return groups.value.map((g, i) => ({ g, i })).filter(({ g }) => g.name.toLowerCase().includes(kw))
})
const activeFilteredLinks = computed(() => {
  const list = active.value?.links || []
  const kw = linkKw.value.trim().toLowerCase()
  return kw ? list.filter(l => l.name.toLowerCase().includes(kw) || l.url.toLowerCase().includes(kw)) : list
})
const activePages = computed(() => Math.max(1, Math.ceil(activeFilteredLinks.value.length / PAGE_SIZE)))
const pagedLinks = computed(() => activeFilteredLinks.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

const recFiltered = computed(() => {
  const kw = linkKw.value.trim().toLowerCase()
  return kw ? recommended.value.filter(l => l.name.toLowerCase().includes(kw) || l.url.toLowerCase().includes(kw)) : recommended.value
})
const recPages = computed(() => Math.max(1, Math.ceil(recFiltered.value.length / PAGE_SIZE)))
const pagedRec = computed(() => recFiltered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

watch([view, activeGroup, linkKw], () => { page.value = 1 })
watch(activePages, (n) => { if (page.value > n) page.value = n })
watch(recPages, (n) => { if (page.value > n) page.value = n })

function groupDupCount(g: AGroup) {
  return g.links.filter(l => duplicateKeys.value.has(normalizeKey(l.url))).length
}

function healthOf(l: ALink): HealthInfo | undefined {
  return health.value[normalizeKey(l.url)]
}
function isDup(l: ALink) {
  return duplicateKeys.value.has(normalizeKey(l.url))
}
function isRecDup(l: ALink) {
  return recDuplicateKeys.value.has(normalizeKey(l.url))
}
const editorDup = computed(() => {
  const ed = linkEditor.value
  if (!ed) return false
  const key = normalizeKey(ed.draft.url)
  if (!key) return false
  const pool = ed.kind === 'recommended' ? recommended.value : groupLinks.value
  return pool.some(l => l !== ed.original && normalizeKey(l.url) === key)
})
function healthText(l: ALink): string {
  const h = healthOf(l)
  if (!h) return ''
  const when = h.checkedAt ? new Date(h.checkedAt).toLocaleString('zh-CN', { hour12: false }) : ''
  return `${h.status ? 'HTTP ' + h.status : '无法访问'} · ${when}`
}
function hideImg(e: Event) {
  const el = e.target as HTMLImageElement
  if (el) el.style.visibility = 'hidden'
}
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
function isSharedCategory(name: string): boolean {
  return (SITE_CATEGORIES as readonly string[]).includes(name)
}
function addGroup() {
  const used = new Set(groups.value.map(g => g.name))
  const name = SITE_CATEGORIES.find(c => !used.has(c)) || '其他'
  groups.value.push({ name, links: [] })
  view.value = 'group'
  activeGroup.value = groups.value.length - 1
  linkKw.value = ''
  page.value = 1
}
function removeGroup() {
  const g = active.value
  if (!g || !confirm(`确定删除分组「${g.name}」及其 ${g.links.length} 条链接？`)) return
  groups.value.splice(activeGroup.value, 1)
  activeGroup.value = Math.min(activeGroup.value, Math.max(0, groups.value.length - 1))
  flash('分组已删除，保存后生效')
}
function moveGroup(d: number) {
  const i = activeGroup.value
  const j = i + d
  if (j < 0 || j >= groups.value.length) return
  const [it] = groups.value.splice(i, 1)
  groups.value.splice(j, 0, it)
  activeGroup.value = j
}
function addLink() {
  if (!active.value) return
  const l: ALink = { name: '', url: '' }
  active.value.links.push(l)
  linkKw.value = ''
  page.value = Math.max(1, Math.ceil(active.value.links.length / PAGE_SIZE))
  openLinkEditor(l, active.value.links, active.value.name, 'group', true)
}
function addRec() {
  const l: ALink = { name: '', url: '' }
  recommended.value.push(l)
  view.value = 'recommended'
  linkKw.value = ''
  page.value = Math.max(1, Math.ceil(recommended.value.length / PAGE_SIZE))
  openLinkEditor(l, recommended.value, '推荐站点', 'recommended', true)
}

function openLinkEditor(l: ALink, list: ALink[], groupName: string, kind: 'group' | 'recommended', isNew = false) {
  linkEditor.value = { draft: { ...l }, original: l, list, groupName, kind, isNew, indexAtOpen: list.indexOf(l) }
}

function closeLinkEditor() {
  const ed = linkEditor.value
  if (ed?.isNew) {
    const i = ed.list.indexOf(ed.original)
    if (i >= 0) ed.list.splice(i, 1)
  } else if (ed) {
    const i = ed.list.indexOf(ed.original)
    if (i >= 0 && i !== ed.indexAtOpen) {
      ed.list.splice(i, 1)
      ed.list.splice(Math.min(ed.indexAtOpen, ed.list.length), 0, ed.original)
    }
  }
  linkEditor.value = null
}

function saveLinkEditor() {
  const ed = linkEditor.value
  if (!ed) return
  const name = ed.draft.name.trim()
  const url = normalizeUrl(ed.draft.url) || ed.draft.url.trim()
  if (!name) { flash('请填写站点名称', 'err'); return }
  if (!/^https?:\/\//i.test(url)) { flash('请填写有效网址', 'err'); return }
  Object.assign(ed.original, { name, url, icon: ed.draft.icon || iconFor(url) })
  linkEditor.value = null
  flash('已修改，点击「保存全部」后生效')
}

function editorMove(d: number) {
  const ed = linkEditor.value
  if (!ed) return
  const i = ed.list.indexOf(ed.original)
  const j = i + d
  if (i < 0 || j < 0 || j >= ed.list.length) return
  const [it] = ed.list.splice(i, 1)
  ed.list.splice(j, 0, it)
}

function editorDelete() {
  const ed = linkEditor.value
  if (!ed) return
  const label = ed.draft.name || hostOf(ed.draft.url) || '该站点'
  if (!confirm(`确定删除「${label}」？保存全部后生效。`)) return
  const i = ed.list.indexOf(ed.original)
  if (i >= 0) ed.list.splice(i, 1)
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

async function load() {
  loading.value = true
  try {
    const d: any = await $fetch('/api/admin/nav')
    groups.value = (d.groups || []).map((g: any) => ({
      name: g.name,
      recommended: !!g.recommended,
      links: (g.links || []).map((l: any) => ({ name: l.name, url: l.url, icon: l.icon || '' }))
    }))
    recommended.value = (d.recommended || []).map((l: any) => ({ name: l.name, url: l.url, icon: l.icon || '' }))
    activeGroup.value = 0
    snapshot.value = JSON.stringify({ groups: groups.value, recommended: recommended.value })
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
  saving.value = true
  try {
    const payloadGroups = groups.value.map(g => ({
      ...g,
      links: g.links.map(l => ({ ...l, url: normalizeUrl(l.url), icon: l.icon || iconFor(l.url) }))
    }))
    const payloadRec = recommended.value.map(l => ({ ...l, url: normalizeUrl(l.url), icon: l.icon || iconFor(l.url) }))
    const d: any = await $fetch('/api/admin/nav', {
      method: 'PUT',
      body: { groups: payloadGroups, recommended: payloadRec }
    })
    groups.value = (d.groups || []).map((g: any) => ({
      name: g.name,
      recommended: !!g.recommended,
      links: (g.links || []).map((l: any) => ({ name: l.name, url: l.url, icon: l.icon || '' }))
    }))
    recommended.value = (d.recommended || []).map((l: any) => ({ name: l.name, url: l.url, icon: l.icon || '' }))
    snapshot.value = JSON.stringify({ groups: groups.value, recommended: recommended.value })
    flash('已保存并同步到前台')
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
    groups.value = d.groups
    recommended.value = d.recommended
    activeGroup.value = 0
    snapshot.value = JSON.stringify({ groups: groups.value, recommended: recommended.value })
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
    if (!confirm(`识别到 ${totalCount} 个书签（${folders.length} 个文件夹），按文件夹合并并立即保存？`)) return
    let added = 0
    const seen = new Set(groups.value.flatMap(g => g.links.map(x => normalizeKey(x.url))))
    for (const f of folders) {
      let g = groups.value.find(x => x.name.toLowerCase() === f.folder.toLowerCase())
      if (!g) {
        g = { name: f.folder, links: [] }
        groups.value.push(g)
      }
      for (const l of f.links) {
        if (g.links.length >= 200) break
        const k = normalizeKey(l.url)
        if (!k || seen.has(k)) continue
        seen.add(k)
        g.links.push({ name: l.name || hostOf(l.url), url: l.url, icon: iconFor(l.url) })
        added++
      }
    }
    if (!added) { flash('没有新增书签（均已存在）'); return }
    const ok = await save()
    flash(ok ? `已导入并保存 ${added} 个书签` : `已导入 ${added} 个书签，请手动保存`, ok ? 'ok' : 'err')
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

function switchGroup(i: number) {
  view.value = 'group'
  activeGroup.value = i
  linkKw.value = ''
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
    <section class="card p-3.5 mb-4">
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-semibold text-[15px]">首页导航配置</h2>
            <span v-if="dirty" class="chip !text-[10px] text-warning">有未保存修改</span>
          </div>
          <p class="text-[12px] text-ink2 mt-1">
            {{ groups.length }} 个分组 · {{ allLinks.length }} 条链接
            <span v-if="duplicateCount" class="text-warning" title="分组内、推荐内分别检测；同一网址同时出现在分组和推荐中属于正常置顶配置">· {{ duplicateCount }} 条重复网址</span>
            <span v-if="invalidCount" class="text-danger">· {{ invalidCount }} 条待补全</span>
          </p>
        </div>
        <div class="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <button class="btn btn-sm" @click="bookmarkInput?.click()">导入书签</button>
          <button class="btn btn-sm" @click="fileInput?.click()">导入 JSON</button>
          <button class="btn btn-sm" @click="exportJson">导出 JSON</button>
          <button class="btn btn-sm btn-primary col-span-2 sm:col-auto" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存全部' }}</button>
          <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importJson" />
          <input ref="bookmarkInput" type="file" accept="text/html,.html,.htm" class="hidden" @change="importBookmarks" />
        </div>
      </div>
      <p v-if="msg" class="text-[12.5px] mt-2" :class="msgKind === 'err' ? 'text-danger' : 'text-success'">{{ msg }}</p>
    </section>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <template v-else>
      <div class="lg:hidden flex gap-1 p-1 rounded-xl bg-card2 border border-line mb-3">
        <button
          class="flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors"
          :class="view === 'group' ? 'bg-ink text-bg' : 'text-ink2'"
          @click="view = 'group'; page = 1; linkKw = ''"
        >分组 <span class="text-[11px] opacity-70">{{ groups.length }}</span></button>
        <button
          class="flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors"
          :class="view === 'recommended' ? 'bg-ink text-bg' : 'text-ink2'"
          @click="view = 'recommended'; page = 1; linkKw = ''"
        >推荐站点 <span class="text-[11px] opacity-70">{{ recommended.length }}</span></button>
      </div>

      <div v-if="view === 'group'" class="lg:hidden mb-3">
        <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
          <button
            v-for="item in filteredGroups"
            :key="item.i"
            class="shrink-0 h-9 px-3 rounded-lg border text-[12.5px] transition-colors"
            :class="activeGroup === item.i ? 'bg-ink text-bg border-ink font-medium' : 'bg-card border-line text-ink2'"
            @click="switchGroup(item.i)"
          >
            {{ item.g.name }} <span class="opacity-60">{{ item.g.links.length }}</span>
          </button>
          <button class="shrink-0 h-9 px-3 rounded-lg border border-dashed border-line text-[12.5px] text-ink2" @click="addGroup">+ 分组</button>
        </div>
      </div>

      <div class="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-4 items-start">
      <aside class="hidden lg:block card p-2.5 lg:sticky lg:top-[72px]">
        <button
          class="w-full flex items-center gap-2 px-3 h-10 rounded-xl text-left text-[13px] font-medium mb-1.5"
          :class="view === 'recommended' ? 'bg-ink text-bg' : 'hover:bg-card2'"
          @click="view = 'recommended'; page = 1; linkKw = ''"
        >
          <span class="flex-1">推荐站点</span>
          <span class="text-[11px] opacity-70">{{ recommended.length }}</span>
        </button>
        <div class="flex items-center gap-1.5 px-1 mb-1.5">
          <span class="text-[10.5px] font-medium uppercase tracking-wider text-ink3 flex-1">分组</span>
          <button class="btn btn-sm btn-ghost !h-7 !px-2" @click="addGroup">新建</button>
        </div>
        <input v-if="groups.length > 6" v-model="groupKw" class="field !h-8 text-[12px] mb-1.5" placeholder="筛选分组" />
        <div class="flex flex-col gap-0.5 max-h-[320px] lg:max-h-[calc(100vh-280px)] overflow-y-auto">
          <button
            v-for="item in filteredGroups"
            :key="item.i"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-[12.5px]"
            :class="view === 'group' && activeGroup === item.i ? 'bg-card2 font-medium' : 'hover:bg-card2'"
            @click="switchGroup(item.i)"
          >
            <span class="flex-1 truncate">{{ item.g.name }}</span>
            <span class="text-[10.5px] text-ink3">{{ item.g.links.length }}</span>
            <span v-if="groupDupCount(item.g)" class="w-1.5 h-1.5 rounded-full bg-warning" :title="`${groupDupCount(item.g)} 条重复`" />
          </button>
          <p v-if="!filteredGroups.length" class="text-[12px] text-ink3 px-3 py-3">没有匹配的分组</p>
        </div>
      </aside>

      <section class="card p-3.5 sm:p-4 min-w-0">
        <template v-if="view === 'group' && active">
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <select v-model="active.name" class="field flex-1 sm:!max-w-[240px] font-medium">
                  <option v-if="!isSharedCategory(active.name)" :value="active.name">{{ active.name }}（旧分类）</option>
                  <option v-for="c in SITE_CATEGORIES" :key="c" :value="c">{{ c }}</option>
                </select>
                <span class="chip shrink-0">{{ active.links.length }} 条</span>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <label class="flex items-center gap-1.5 text-[12.5px] text-ink2 cursor-pointer">
                  <input v-model="active.recommended" type="checkbox" /> 首页优先展示
                </label>
                <div class="flex-1" />
                <div class="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex">
                  <button class="btn btn-sm" :disabled="activeGroup === 0" @click="moveGroup(-1)">上移</button>
                  <button class="btn btn-sm" :disabled="activeGroup === groups.length - 1" @click="moveGroup(1)">下移</button>
                  <button class="btn btn-sm btn-ghost text-danger" @click="removeGroup">删除</button>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <button class="btn btn-sm btn-primary" @click="addLink">添加链接</button>
              <button class="btn btn-sm" :disabled="bulkBusy" @click="bulkFill(active.links)">
                {{ bulkBusy ? `补全中 ${bulkDone}/${bulkTotal}` : '补全名称/图标' }}
              </button>
              <button class="btn btn-sm" :disabled="checking" @click="checkLinks(active.links)">
                {{ checking ? `巡检 ${checkDone}/${checkTotal}` : '巡检本组' }}
              </button>
              <div class="flex-1" />
              <input v-model="linkKw" class="field !h-8 sm:!w-48" placeholder="筛选本组链接" />
            </div>

            <div v-if="!activeFilteredLinks.length" class="py-10 text-center text-ink3 text-[13px] border border-dashed border-line rounded-xl">
              本组暂无链接，点击「添加链接」开始。
            </div>
            <div v-else class="flex flex-col gap-1.5">
              <div
                v-for="l in pagedLinks"
                :key="l"
                class="group flex items-center gap-2 rounded-xl border border-line bg-card/40 pl-2 pr-1.5 py-1.5 cursor-pointer hover:border-line2 hover:bg-card2/60 transition-colors"
                @click="openLinkEditor(l, active.links, active.name, 'group')"
              >
                <span class="grid place-items-center w-7 h-7 rounded-lg border border-line bg-card shrink-0">
                  <img v-if="l.url" :src="l.icon || iconFor(l.url)" alt="" class="w-4 h-4 object-contain" loading="lazy" referrerpolicy="no-referrer" @error="hideImg" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <span class="text-[13px] font-medium truncate" :class="!l.name && 'text-ink3'">{{ l.name || '未命名站点' }}</span>
                    <span v-if="isDup(l)" class="shrink-0 text-[9.5px] leading-none px-1 py-0.5 rounded bg-warning/15 text-warning">重复</span>
                    <span v-if="healthOf(l)" class="w-1.5 h-1.5 rounded-full shrink-0" :class="healthOf(l)!.status && healthOf(l)!.status < 400 ? 'bg-success' : 'bg-danger'" :title="healthText(l)" />
                  </span>
                  <span class="block text-[11px] text-ink3 truncate leading-tight mt-0.5">{{ l.url || '未填写网址' }}</span>
                </span>
                <button class="btn btn-sm btn-ghost shrink-0 !h-8 !px-2.5" @click.stop="openLinkEditor(l, active.links, active.name, 'group')">编辑</button>
              </div>
            </div>

            <AdminPager :page="page" :total="activeFilteredLinks.length" :size="PAGE_SIZE" @change="page = $event" />
          </div>
        </template>

        <template v-else-if="view === 'recommended'">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2 flex-wrap">
              <div>
                <h3 class="font-semibold text-[14px]">推荐站点</h3>
                <p class="text-[11.5px] text-ink3 mt-0.5">按网址匹配，命中后在各分类内置顶并加「荐」标。</p>
              </div>
              <div class="flex-1" />
              <button class="btn btn-sm btn-primary" @click="addRec">添加推荐</button>
              <button class="btn btn-sm" :disabled="bulkBusy" @click="bulkFill(recommended)">补全名称/图标</button>
              <button class="btn btn-sm" :disabled="checking" @click="checkLinks(recommended)">巡检</button>
            </div>
            <input v-model="linkKw" class="field !h-8 sm:!max-w-[260px]" placeholder="筛选推荐站点" />
            <div v-if="!recFiltered.length" class="py-10 text-center text-ink3 text-[13px] border border-dashed border-line rounded-xl">暂无推荐站点</div>
            <div v-else class="flex flex-col gap-1.5">
              <div
                v-for="l in pagedRec"
                :key="l"
                class="group flex items-center gap-2 rounded-xl border border-line bg-card/40 pl-2 pr-1.5 py-1.5 cursor-pointer hover:border-line2 hover:bg-card2/60 transition-colors"
                @click="openLinkEditor(l, recommended, '推荐站点', 'recommended')"
              >
                <span class="grid place-items-center w-7 h-7 rounded-lg border border-line bg-card shrink-0">
                  <img v-if="l.url" :src="l.icon || iconFor(l.url)" alt="" class="w-4 h-4 object-contain" loading="lazy" referrerpolicy="no-referrer" @error="hideImg" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <span class="text-[13px] font-medium truncate" :class="!l.name && 'text-ink3'">{{ l.name || '未命名站点' }}</span>
                    <span v-if="isRecDup(l)" class="shrink-0 text-[9.5px] leading-none px-1 py-0.5 rounded bg-warning/15 text-warning">重复</span>
                    <span v-if="healthOf(l)" class="w-1.5 h-1.5 rounded-full shrink-0" :class="healthOf(l)!.status && healthOf(l)!.status < 400 ? 'bg-success' : 'bg-danger'" :title="healthText(l)" />
                  </span>
                  <span class="block text-[11px] text-ink3 truncate leading-tight mt-0.5">{{ l.url || '未填写网址' }}</span>
                </span>
                <button class="btn btn-sm btn-ghost shrink-0 !h-8 !px-2.5" @click.stop="openLinkEditor(l, recommended, '推荐站点', 'recommended')">编辑</button>
              </div>
            </div>
            <AdminPager :page="page" :total="recFiltered.length" :size="PAGE_SIZE" @change="page = $event" />
          </div>
        </template>

        <div v-else class="py-12 text-center text-ink3 text-[13px]">请选择左侧分组</div>
      </section>
      </div>
    </template>

    <div v-if="linkEditor" class="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="closeLinkEditor" />
      <div class="relative w-full h-[100dvh] sm:h-auto sm:max-w-[520px] sm:max-h-[90vh] flex flex-col bg-card border-line sm:border sm:rounded-2xl shadow-xl overflow-hidden">
        <div class="shrink-0 flex items-center gap-2 px-4 h-14 border-b border-line bg-card">
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold text-[15px] truncate">
              {{ linkEditor.isNew ? '添加站点' : linkEditor.kind === 'recommended' ? '编辑推荐站点' : '编辑站点' }}
            </h2>
            <p class="text-[11px] text-ink3 truncate">{{ linkEditor.groupName }} · 修改后点「保存全部」生效</p>
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
              <span class="text-[12px] text-ink2">图标地址（可选，留空自动获取）</span>
              <input v-model="linkEditor.draft.icon" class="field" placeholder="https://.../icon.png" />
            </label>

            <p v-if="editorDup" class="text-[11.5px] text-warning">该网址与{{ linkEditor.kind === 'recommended' ? '其他推荐站点' : '其他导航条目' }}重复</p>
            <p v-if="healthText(linkEditor.draft)" class="text-[11.5px] text-ink3">{{ healthText(linkEditor.draft) }}</p>

            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <button type="button" class="btn btn-sm" :disabled="!!fetching || !linkEditor.draft.url" @click="editorFetch">
                {{ fetching ? '抓取中…' : '抓取站点信息' }}
              </button>
              <div class="flex-1" />
              <button type="button" class="btn btn-sm btn-ghost" :disabled="linkEditor.list.indexOf(linkEditor.original) <= 0" @click="editorMove(-1)">上移</button>
              <button type="button" class="btn btn-sm btn-ghost" :disabled="linkEditor.list.indexOf(linkEditor.original) >= linkEditor.list.length - 1" @click="editorMove(1)">下移</button>
              <button v-if="!linkEditor.isNew" type="button" class="btn btn-sm btn-ghost text-danger" @click="editorDelete">删除</button>
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
