<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

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
}

const items = ref<Entry[]>([])
const total = ref(0)
const published = ref(0)
const categories = ref<any[]>([])
const page = ref(1)
const kw = ref('')
const category = ref('')
const status = ref('')
const loading = ref(false)
const msg = ref('')
const size = 20

const editing = ref<Entry | null>(null)
const saving = ref(false)
const formError = ref('')

useSeoMeta({ title: '分类目录 · 2077 管理后台', robots: 'noindex' })

const emptyEntry = (): Entry => ({
  name: '', url: '', icon: '', category: '其他', title: '', description: '',
  keywords: '', content: '', featured: 0, sort: 0, status: 'published'
})

async function load() {
  loading.value = true
  try {
    const qs = new URLSearchParams({ page: String(page.value), size: String(size) })
    if (kw.value.trim()) qs.set('q', kw.value.trim())
    if (category.value) qs.set('category', category.value)
    if (status.value) qs.set('status', status.value)
    const d: any = await $fetch(`/api/admin/directory?${qs}`)
    items.value = d.items || []
    total.value = d.total || 0
    published.value = d.published || 0
    categories.value = d.categories || []
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

onMounted(load)
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
          <option v-for="c in categories" :key="c.category" :value="c.category">{{ c.category }}（{{ c.n }}）</option>
        </select>
        <span class="text-[12.5px] text-ink2 ml-auto">共 {{ total }} 个 · 已发布 {{ published }}</span>
        <button class="btn btn-sm btn-primary" @click="openCreate">新增站点</button>
      </div>
      <form class="flex gap-2" @submit.prevent="search">
        <input v-model="kw" class="field grow sm:max-w-[320px]" placeholder="搜索名称、网址或简介" />
        <button class="btn shrink-0" type="submit">搜索</button>
        <button v-if="kw || category || status" type="button" class="btn btn-ghost shrink-0" @click="kw = ''; category = ''; status = ''; search()">重置</button>
      </form>
      <p v-if="msg" class="text-[13px] text-ink2">{{ msg }}</p>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">
      暂无目录站点，点击「新增站点」或到「链接发现」批量导入。
    </div>
    <div v-else class="card overflow-hidden divide-y divide-line">
      <div v-for="e in items" :key="e.id" class="p-3.5 sm:p-4">
        <div class="flex items-start gap-3">
          <img v-if="e.icon || iconOf(e.url)" :src="e.icon || iconOf(e.url)" alt="" class="w-9 h-9 rounded-lg object-contain bg-card2 shrink-0" loading="lazy" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-medium text-[13.5px]">{{ e.name }}</span>
              <span class="chip !text-[10px]">{{ e.category }}</span>
              <span v-if="e.featured" class="chip !text-[10px]">推荐</span>
              <span class="chip !text-[10px]" :class="{ 'text-success': e.status === 'published' }">{{ e.status === 'published' ? '已发布' : '已隐藏' }}</span>
            </div>
            <a :href="e.url" target="_blank" rel="noopener" class="block text-[11.5px] text-ink2 truncate hover:text-ink">{{ e.url }}</a>
            <p v-if="e.description" class="text-[11.5px] text-ink3 mt-0.5 line-clamp-1">{{ e.description }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
          <NuxtLink :to="`/site/${e.id}.html`" target="_blank" class="btn btn-sm btn-ghost">查看详情</NuxtLink>
          <button class="btn btn-sm" @click="openEdit(e)">编辑</button>
          <button class="btn btn-sm btn-ghost" @click="act(e, 'status')">{{ e.status === 'published' ? '隐藏' : '发布' }}</button>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost text-danger" @click="act(e, 'delete')">删除</button>
        </div>
      </div>
    </div>

    <AdminPager :page="page" :total="total" :size="size" @change="go" />

    <div v-if="editing" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" @click.self="editing = null">
      <div class="absolute inset-0 bg-black/45" @click="editing = null" />
      <div class="relative w-full sm:max-w-[720px] max-h-[92vh] overflow-y-auto bg-card border border-line rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div class="sticky top-0 z-10 flex items-center gap-2 px-4 h-14 border-b border-line bg-card">
          <h2 class="font-semibold text-[14px]">{{ editing.id ? '编辑目录站点' : '新增目录站点' }}</h2>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost" @click="editing = null">关闭</button>
        </div>
        <form class="p-4 flex flex-col gap-3" @submit.prevent="save">
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-[12px] text-ink2">站点名称 *</span>
              <input v-model="editing.name" class="field" placeholder="例如 2077 导航" required />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[12px] text-ink2">网址 *</span>
              <input v-model="editing.url" class="field" placeholder="https://example.com" required />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[12px] text-ink2">分类</span>
              <input v-model="editing.category" class="field" list="dir-categories" placeholder="例如 开发工具" />
              <datalist id="dir-categories">
                <option v-for="c in categories" :key="c.category" :value="c.category" />
              </datalist>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[12px] text-ink2">图标地址（留空自动抓取）</span>
              <input v-model="editing.icon" class="field" placeholder="/api/icon?url=..." />
            </label>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-[12px] text-ink2">SEO 标题（留空使用站点名称）</span>
            <input v-model="editing.title" class="field" placeholder="不超过 200 字" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[12px] text-ink2">简介（用于列表与搜索描述）</span>
            <textarea v-model="editing.description" class="field !h-20 py-2 resize-y" placeholder="一两句话介绍该站点" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[12px] text-ink2">关键词（逗号分隔）</span>
            <input v-model="editing.keywords" class="field" placeholder="导航,工具,资源" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[12px] text-ink2">详情页正文（可选，支持换行）</span>
            <textarea v-model="editing.content" class="field !h-32 py-2 resize-y" placeholder="补充介绍、使用说明等，将展示在详情页" />
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
            <label class="flex flex-col gap-1">
              <span class="text-[12px] text-ink2">排序（越大越靠前）</span>
              <input v-model.number="editing.sort" type="number" min="0" max="9999" class="field" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[12px] text-ink2">状态</span>
              <select v-model="editing.status" class="field">
                <option value="published">已发布</option>
                <option value="hidden">已隐藏</option>
              </select>
            </label>
            <label class="flex items-center gap-2 h-[38px]">
              <input v-model="editing.featured" type="checkbox" :true-value="1" :false-value="0" class="w-4 h-4 accent-current" />
              <span class="text-[12.5px] text-ink2">设为推荐</span>
            </label>
          </div>
          <p v-if="formError" class="text-[12.5px] text-danger">{{ formError }}</p>
          <div class="flex gap-2 pt-1">
            <button class="btn btn-primary flex-1 sm:flex-none sm:min-w-[120px]" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
            <button class="btn flex-1 sm:flex-none" type="button" @click="editing = null">取消</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
