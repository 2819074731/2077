<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { iconFor, hostOf } from '~/data/nav'
import { parseBookmarksHtml } from '#shared/bookmarks'

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

const allLinks = computed(() => [
  ...groups.value.flatMap(g => g.links),
  ...recommended.value
])

const duplicateKeys = computed(() => {
  const counts = new Map<string, number>()
  for (const l of groups.value.flatMap(g => g.links)) {
    const k = normalizeKey(l.url)
    if (!k) continue
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  return new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([k]) => k))
})

const duplicateCount = computed(() =>
  groups.value.flatMap(g => g.links).filter(l => duplicateKeys.value.has(normalizeKey(l.url))).length
)

const invalidCount = computed(() =>
  allLinks.value.filter(l => !l.name.trim() || !/^https?:\/\//i.test(l.url.trim())).length
)

const knownHealth = computed(() =>
  allLinks.value.filter(l => health.value[normalizeKey(l.url)]).length
)

const badKeys = computed(() => {
  const set = new Set<string>()
  for (const l of allLinks.value) {
    const k = normalizeKey(l.url)
    const h = health.value[k]
    if (!h) continue
    if (h.status === 0 || h.status >= 400) set.add(k)
  }
  return set
})

function isDup(l: ALink) {
  return duplicateKeys.value.has(normalizeKey(l.url))
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
  const key = l.url
  if (!key || !/^https?:\/\//i.test(key) || fetching.value) return
  fetching.value = key
  try {
    const d: any = await $fetch('/api/meta', { method: 'POST', body: { url: key } })
    applyMeta(l, d.meta)
    flash('已抓取站点信息')
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '抓取失败', 'err')
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

function onUrlBlur(l: ALink) {
  if (!/^https?:\/\//i.test(l.url)) return
  if (!l.icon) l.icon = iconFor(l.url)
  if (!l.name) fetchMeta(l)
}

function addGroup() { groups.value.push({ name: '新分组', links: [] }) }
function removeGroup(i: number) { groups.value.splice(i, 1) }
function addLink(g: AGroup) { g.links.push({ name: '', url: '' }) }
function removeLink(g: AGroup, i: number) { g.links.splice(i, 1) }
function moveLink(g: AGroup, i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= g.links.length) return
  const [it] = g.links.splice(i, 1)
  g.links.splice(j, 0, it)
}
function moveGroup(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= groups.value.length) return
  const [it] = groups.value.splice(i, 1)
  groups.value.splice(j, 0, it)
}

function addRec() { recommended.value.push({ name: '', url: '' }) }
function removeRec(i: number) { recommended.value.splice(i, 1) }
function moveRec(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= recommended.value.length) return
  const [it] = recommended.value.splice(i, 1)
  recommended.value.splice(j, 0, it)
}

async function save() {
  if (invalidCount.value) {
    flash(`有 ${invalidCount.value} 条链接缺少名称或网址无效`, 'err')
    return
  }
  saving.value = true
  try {
    const payloadGroups = groups.value.map(g => ({
      ...g,
      links: g.links.map(l => ({ ...l, icon: l.icon || iconFor(l.url) }))
    }))
    const d: any = await $fetch('/api/admin/nav', {
      method: 'PUT',
      body: { groups: payloadGroups, recommended: recommended.value }
    })
    groups.value = d.groups
    recommended.value = d.recommended
    flash('已保存')
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '保存失败', 'err')
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
    const total = folders.reduce((n, f) => n + f.links.length, 0)
    if (!total) { flash('未识别到书签，请确认是浏览器导出的 HTML 文件', 'err'); return }
    if (!window.confirm(`识别到 ${total} 个书签（${folders.length} 个文件夹），按文件夹合并到现有分组？`)) return
    let added = 0
    const seen = new Set(groups.value.flatMap(g => g.links.map(x => normalizeKey(x.url))))
    for (const f of folders) {
      let g = groups.value.find(x => x.name === f.folder)
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
    flash(`已导入 ${added} 个书签，记得保存`)
  } catch (err: any) {
    flash(err?.message || '书签解析失败', 'err')
  }
}

async function bulkFill() {
  if (bulkBusy.value) return
  const links = groups.value.flatMap(g => g.links)
  let iconFixed = 0
  for (const l of links) {
    if (/^https?:\/\//i.test(l.url) && !l.icon) {
      l.icon = iconFor(l.url)
      iconFixed++
    }
  }
  const targets = links.filter(l => /^https?:\/\//i.test(l.url) && !l.name)
  if (!targets.length) {
    flash(iconFixed ? `已补全 ${iconFixed} 个图标` : '没有需要补全的链接')
    return
  }
  bulkBusy.value = true
  bulkTotal.value = targets.length
  bulkDone.value = 0
  let cursor = 0
  const workers = Array.from({ length: 2 }, async () => {
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

async function checkLinks() {
  if (checking.value) return
  const seen = new Set<string>()
  const urls: string[] = []
  for (const l of allLinks.value) {
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
      const d: any = await $fetch('/api/admin/health/check', {
        method: 'POST',
        body: { urls: batch }
      })
      for (const it of d.items || []) {
        const k = normalizeKey(it.url)
        if (!k) continue
        health.value[k] = { status: Number(it.status || 0), checkedAt: new Date().toISOString() }
      }
      checkDone.value = Math.min(i + batch.length, urls.length)
    }
    const bad = badKeys.value.size
    flash(bad ? `巡检完成，${bad} 个网址异常` : '巡检完成，全部正常', bad ? 'err' : 'ok')
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '巡检失败', 'err')
  } finally {
    checking.value = false
  }
}

onMounted(async () => {
  try {
    const d: any = await $fetch('/api/admin/nav')
    groups.value = (d.groups || []).map((g: any) => ({
      ...g,
      links: (g.links || []).map((l: any) => ({ ...l, icon: l.icon || iconFor(l.url) }))
    }))
    recommended.value = (d.recommended || []).map((l: any) => ({ ...l, icon: l.icon || iconFor(l.url) }))
    loadHealth()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex items-center gap-2 mb-3 flex-wrap">
      <p class="text-[13px] text-ink2 flex-1 min-w-[220px]">维护访客看到的默认导航。支持书签导入、自动抓取图标与名称、重复检测、死链巡检。</p>
      <button class="btn btn-sm" @click="exportJson">导出 JSON</button>
      <button class="btn btn-sm" @click="fileInput?.click()">导入 JSON</button>
      <button class="btn btn-sm" @click="bookmarkInput?.click()">导入书签</button>
      <button class="btn btn-sm" :disabled="bulkBusy" @click="bulkFill">{{ bulkBusy ? `补全中 ${bulkDone}/${bulkTotal}` : '补全图标/名称' }}</button>
      <button class="btn btn-sm" :disabled="checking" @click="checkLinks">{{ checking ? `巡检 ${checkDone}/${checkTotal}` : '巡检死链' }}</button>
      <button class="btn btn-sm" @click="addGroup">+ 分组</button>
      <button class="btn btn-sm btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importJson" />
      <input ref="bookmarkInput" type="file" accept="text/html,.html,.htm" class="hidden" @change="importBookmarks" />
    </div>

    <div class="flex items-center gap-3 flex-wrap mb-4 min-h-[20px] text-[12px]">
      <span v-if="msg" :class="msgKind === 'err' ? 'text-danger' : 'text-success'">{{ msg }}</span>
      <span v-if="duplicateCount" class="text-warning">{{ duplicateCount }} 条重复网址</span>
      <span v-if="knownHealth" class="text-ink3">已巡检 {{ knownHealth }} 条<span v-if="badKeys.size" class="text-danger">，{{ badKeys.size }} 条异常</span></span>
      <span v-if="invalidCount" class="text-danger">{{ invalidCount }} 条待补全</span>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else class="flex flex-col gap-4">
      <section class="card p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="h-3.5 w-1 rounded-full accent-bar" />
          <span class="font-medium text-[13.5px]">推荐站点</span>
          <span class="chip">{{ recommended.length }}</span>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost" @click="addRec">+ 推荐</button>
        </div>
        <p class="text-[12px] text-ink3 mb-2">按网址匹配，命中后在各分类内置顶并加「荐」标；分类中没有的网址不会单独展示。</p>
        <div v-if="!recommended.length" class="text-[12.5px] text-ink3 py-3 text-center border border-dashed border-line rounded-xl">暂无推荐站点</div>
        <div v-for="(l, li) in recommended" :key="li" class="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
          <div class="flex items-center gap-2 min-w-0 sm:contents">
            <span class="grid place-items-center w-7 h-7 rounded-lg border border-line bg-card shrink-0">
              <img v-if="l.url" :src="l.icon || iconFor(l.url)" alt="" class="w-4 h-4 object-contain" loading="lazy" referrerpolicy="no-referrer" @error="hideImg" />
            </span>
            <span v-if="healthOf(l)" class="w-1.5 h-1.5 rounded-full shrink-0" :class="badKeys.has(normalizeKey(l.url)) ? 'bg-danger' : 'bg-success'" :title="healthText(l)" />
            <input v-model="l.name" class="field sm:!w-40" placeholder="名称" @blur="onUrlBlur(l)" />
          </div>
          <input v-model="l.url" class="field grow min-w-0" placeholder="https://..." @blur="onUrlBlur(l)" />
          <div class="flex gap-1">
            <button class="btn btn-sm btn-ghost !px-2" :disabled="fetching === l.url" title="抓取名称与图标" @click="fetchMeta(l)">{{ fetching === l.url ? '…' : '抓' }}</button>
            <button class="btn btn-sm btn-ghost !px-2" :disabled="li === 0" @click="moveRec(li, -1)">↑</button>
            <button class="btn btn-sm btn-ghost !px-2" :disabled="li === recommended.length - 1" @click="moveRec(li, 1)">↓</button>
            <button class="btn btn-sm btn-ghost text-ink2 !px-2" @click="removeRec(li)">删</button>
          </div>
        </div>
      </section>

      <section v-for="(g, gi) in groups" :key="gi" class="card p-4">
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <input v-model="g.name" class="field !h-9 !w-48 font-medium" placeholder="分组名称" />
          <label class="flex items-center gap-1.5 text-[12.5px] text-ink2 cursor-pointer">
            <input v-model="g.recommended" type="checkbox" /> 首页优先展示
          </label>
          <span class="chip">{{ g.links.length }}</span>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost !px-2" :disabled="gi === 0" @click="moveGroup(gi, -1)">↑</button>
          <button class="btn btn-sm btn-ghost !px-2" :disabled="gi === groups.length - 1" @click="moveGroup(gi, 1)">↓</button>
          <button class="btn btn-sm btn-ghost" @click="addLink(g)">+ 链接</button>
          <button class="btn btn-sm btn-ghost text-ink2" @click="removeGroup(gi)">删除分组</button>
        </div>
        <div v-if="!g.links.length" class="text-[12.5px] text-ink3 py-3 text-center border border-dashed border-line rounded-xl">暂无链接</div>
        <div v-for="(l, li) in g.links" :key="li" class="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
          <div class="flex items-center gap-2 min-w-0 sm:contents">
            <span class="grid place-items-center w-7 h-7 rounded-lg border border-line bg-card shrink-0">
              <img v-if="l.url" :src="l.icon || iconFor(l.url)" alt="" class="w-4 h-4 object-contain" loading="lazy" referrerpolicy="no-referrer" @error="hideImg" />
            </span>
            <span v-if="healthOf(l)" class="w-1.5 h-1.5 rounded-full shrink-0" :class="badKeys.has(normalizeKey(l.url)) ? 'bg-danger' : 'bg-success'" :title="healthText(l)" />
            <input
              v-model="l.name"
              class="field sm:!w-40"
              :class="isDup(l) ? '!border-warning' : ''"
              placeholder="名称"
              :title="isDup(l) ? '重复网址' : ''"
              @blur="onUrlBlur(l)"
            />
          </div>
          <input
            v-model="l.url"
            class="field grow min-w-0"
            :class="isDup(l) ? '!border-warning' : ''"
            placeholder="https://..."
            :title="isDup(l) ? '重复网址' : ''"
            @blur="onUrlBlur(l)"
          />
          <div class="flex gap-1">
            <button class="btn btn-sm btn-ghost !px-2" :disabled="fetching === l.url || !l.url" title="抓取名称与图标" @click="fetchMeta(l)">{{ fetching === l.url ? '…' : '抓' }}</button>
            <button class="btn btn-sm btn-ghost !px-2" :disabled="li === 0" @click="moveLink(g, li, -1)">↑</button>
            <button class="btn btn-sm btn-ghost !px-2" :disabled="li === g.links.length - 1" @click="moveLink(g, li, 1)">↓</button>
            <button class="btn btn-sm btn-ghost text-ink2 !px-2" @click="removeLink(g, li)">删</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
