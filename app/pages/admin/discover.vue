<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Found { url: string; name: string; host: string }

const url = ref('')
const mode = ref<'external' | 'internal' | 'sitemap'>('external')
const loading = ref(false)
const importing = ref(false)
const msg = ref('')
const error = ref('')
const source = ref('')
const runMode = ref<'external' | 'internal' | 'sitemap'>('external')
const sitemaps = ref(0)
const scanned = ref(0)
const items = ref<Found[]>([])
const selected = ref<Set<string>>(new Set())
const category = ref('其他')
const categories = ref<string[]>([])

useSeoMeta({ title: '链接发现 · 2077 管理后台', robots: 'noindex' })

const modes = [
  { v: 'external', l: '站外链接', d: '提取页面中指向其他域名的链接' },
  { v: 'internal', l: '站内链接', d: '提取同一域名下的页面地址' },
  { v: 'sitemap', l: 'Sitemap', d: '读取 sitemap 或 sitemap index，自动展开嵌套与 .gz' }
] as const

const hostCount = computed(() => {
  const m = new Map<string, number>()
  for (const i of items.value) m.set(i.host, (m.get(i.host) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
})

const allSelected = computed(() => items.value.length > 0 && selected.value.size === items.value.length)

async function loadCategories() {
  try {
    const d: any = await $fetch('/api/admin/directory?size=1')
    categories.value = (d.categories || []).map((c: any) => c.category)
  } catch {}
}

async function run() {
  const target = url.value.trim()
  if (!target) { error.value = '请先填写要分析的网址'; return }
  loading.value = true
  error.value = ''
  msg.value = ''
  items.value = []
  selected.value = new Set()
  source.value = ''
  runMode.value = mode.value
  sitemaps.value = 0
  scanned.value = 0
  try {
    const d: any = await $fetch('/api/admin/discover', { method: 'POST', body: { url: target, mode: mode.value } })
    source.value = d.source || ''
    sitemaps.value = Number(d.sitemaps || 0)
    scanned.value = Number(d.scanned || 0)
    items.value = d.items || []
    msg.value = items.value.length ? `发现 ${items.value.length} 个未收录链接` : '没有发现新的链接'
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.data?.message || '抓取失败，请稍后再试'
  } finally {
    loading.value = false
  }
}

function toggle(u: string) {
  const next = new Set(selected.value)
  if (next.has(u)) next.delete(u)
  else next.add(u)
  selected.value = next
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(items.value.map(i => i.url))
}

function pickHost(host: string) {
  const next = new Set(selected.value)
  const same = items.value.filter(i => i.host === host)
  const allOn = same.every(i => next.has(i.url))
  for (const i of same) {
    if (allOn) next.delete(i.url)
    else next.add(i.url)
  }
  selected.value = next
}

async function importSelected() {
  if (importing.value || !selected.value.size) return
  importing.value = true
  msg.value = ''
  error.value = ''
  try {
    const list = items.value.filter(i => selected.value.has(i.url))
    const d: any = await $fetch('/api/admin/directory', {
      method: 'POST',
      body: { action: 'bulk-create', items: list, category: category.value.trim() || '其他' }
    })
    msg.value = `导入完成：新增 ${d.created} 个，跳过 ${d.skipped} 个`
    const done = new Set(selected.value)
    items.value = items.value.filter(i => !done.has(i.url))
    selected.value = new Set()
    await loadCategories()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.data?.message || '导入失败'
  } finally {
    importing.value = false
  }
}

loadCategories()
</script>

<template>
  <div class="animate-fade-up">
    <section class="card p-4 mb-4">
      <p class="text-[13px] text-ink2 mb-3">
        输入一个网址，从页面链接或 sitemap 中批量发现尚未收录的站点，勾选后直接导入分类目录。
      </p>
      <form class="flex flex-col gap-2" @submit.prevent="run">
        <div class="flex flex-col sm:flex-row gap-2">
          <input v-model="url" class="field grow" placeholder="https://example.com 或 https://example.com/sitemap.xml" />
          <button class="btn btn-primary w-full sm:w-auto shrink-0" type="submit" :disabled="loading">{{ loading ? '分析中…' : '开始分析' }}</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="m in modes"
            :key="m.v"
            type="button"
            class="btn btn-sm"
            :class="mode === m.v ? 'btn-primary' : 'btn-ghost'"
            :title="m.d"
            @click="mode = m.v"
          >{{ m.l }}</button>
          <span class="text-[11.5px] text-ink3 self-center">{{ modes.find(m => m.v === mode)?.d }}</span>
        </div>
      </form>
      <p v-if="error" class="text-[12.5px] text-danger mt-2">{{ error }}</p>
      <p v-else-if="msg" class="text-[12.5px] text-ink2 mt-2">{{ msg }}</p>
      <p v-if="source" class="text-[11.5px] text-ink3 mt-1 break-all">
        来源：{{ source }}
        <span v-if="runMode === 'sitemap'"> · 读取 {{ sitemaps }} 个 sitemap / {{ scanned }} 个页面</span>
      </p>
    </section>

    <template v-if="items.length">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <button class="btn btn-sm" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
        <span class="text-[12.5px] text-ink2">已选 {{ selected.size }} / {{ items.length }}</span>
        <div class="hidden sm:block flex-1" />
        <div class="flex gap-2 w-full sm:w-auto">
          <input v-model="category" class="field flex-1 sm:!w-40 !h-9 sm:!h-8 text-[16px] sm:text-[13px]" list="discover-categories" placeholder="导入分类" />
          <datalist id="discover-categories">
            <option v-for="c in categories" :key="c" :value="c" />
          </datalist>
          <button class="btn btn-sm btn-primary shrink-0" :disabled="!selected.size || importing" @click="importSelected">
            {{ importing ? '导入中…' : `导入所选（${selected.size}）` }}
          </button>
        </div>
      </div>

      <div v-if="hostCount.length" class="flex flex-wrap gap-1.5 mb-3">
        <button
          v-for="[h, n] in hostCount"
          :key="h"
          class="btn btn-sm btn-ghost !text-[11.5px]"
          @click="pickHost(h)"
        >{{ h }} <span class="opacity-60">{{ n }}</span></button>
      </div>

      <div class="card overflow-hidden divide-y divide-line">
        <label v-for="i in items" :key="i.url" class="flex items-start gap-2.5 p-3 cursor-pointer hover:bg-card2">
          <input
            type="checkbox"
            class="w-4 h-4 mt-0.5 shrink-0 accent-current"
            :checked="selected.has(i.url)"
            @change="toggle(i.url)"
          />
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-medium truncate">{{ i.name || i.host }}</span>
            <span class="block text-[11.5px] text-ink2 truncate">{{ i.url }}</span>
          </span>
        </label>
      </div>
    </template>

    <div v-else-if="!loading" class="card p-8 text-center text-ink2 text-[13px]">
      输入网址开始发现链接。导入的站点会出现在「分类目录」中。
    </div>
  </div>
</template>
