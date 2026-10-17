<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { DEFAULT_CATEGORY } from '#shared/categories'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const status = ref('pending')
const kw = ref('')
const loading = ref(false)
const msg = ref('')
const msgKind = ref<'ok' | 'err'>('ok')
const size = 20
const categories = ref<string[]>([DEFAULT_CATEGORY])

const editingItem = ref<any>(null)
const mode = ref<'review' | 'edit'>('review')
const toNav = ref(false)
const toDirectory = ref(false)
const form = ref({ name: '', url: '', title: '', description: '', keywords: '', grp: DEFAULT_CATEGORY })
const acting = ref(false)

useSeoMeta({ title: '收录审核 · 2077 管理后台', robots: 'noindex' })

async function loadCategories() {
  try {
    const d: any = await $fetch('/api/categories')
    categories.value = d.categories || []
  } catch {}
}

async function load() {
  loading.value = true
  try {
    const qs = new URLSearchParams({ page: String(page.value), size: String(size) })
    if (status.value) qs.set('status', status.value)
    if (kw.value.trim()) qs.set('q', kw.value.trim())
    const d: any = await $fetch(`/api/admin/submissions?${qs}`)
    items.value = d.items
    total.value = d.total
  } finally {
    loading.value = false
  }
}

function openReview(item: any) {
  mode.value = 'review'
  editingItem.value = item
  toNav.value = item.target !== 'directory'
  toDirectory.value = true
  form.value = {
    name: item.name || '',
    url: item.url || '',
    title: item.title || '',
    description: item.description || '',
    keywords: item.keywords || '',
    grp: categories.value.includes(item.grp) ? item.grp : DEFAULT_CATEGORY
  }
  msg.value = ''
  msgKind.value = 'ok'
}

function openEdit(item: any) {
  mode.value = 'edit'
  editingItem.value = item
  toNav.value = false
  toDirectory.value = false
  form.value = {
    name: item.name || '',
    url: item.url || '',
    title: item.title || '',
    description: item.description || '',
    keywords: item.keywords || '',
    grp: categories.value.includes(item.grp) ? item.grp : DEFAULT_CATEGORY
  }
  msg.value = ''
  msgKind.value = 'ok'
}

function flash(text: string, kind: 'ok' | 'err' = 'ok') {
  msg.value = text
  msgKind.value = kind
  setTimeout(() => { if (msg.value === text) msg.value = '' }, 2200)
}

async function saveEdit() {
  const item = editingItem.value
  if (!item || acting.value) return
  if (!form.value.name.trim() || !form.value.url.trim()) {
    msg.value = '站点名称和网址不能为空'
    msgKind.value = 'err'
    return
  }
  acting.value = true
  msg.value = ''
  try {
    await $fetch('/api/admin/submissions', {
      method: 'POST',
      body: { id: item.id, action: 'update', data: form.value }
    })
    editingItem.value = null
    flash('提交信息已更新')
    await load()
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || e?.data?.message || '保存失败'
    msgKind.value = 'err'
  } finally {
    acting.value = false
  }
}

async function confirmApprove() {
  const item = editingItem.value
  if (!item || acting.value) return
  if (!form.value.name.trim() || !form.value.url.trim()) {
    msg.value = '站点名称和网址不能为空'
    msgKind.value = 'err'
    return
  }
  if (!toNav.value && !toDirectory.value) {
    msg.value = '请至少选择一个收录位置'
    msgKind.value = 'err'
    return
  }
  acting.value = true
  msg.value = ''
  try {
    const d: any = await $fetch('/api/admin/submissions', {
      method: 'POST',
      body: {
        id: item.id,
        action: 'approve',
        targets: { nav: toNav.value, directory: toDirectory.value },
        category: form.value.grp,
        data: form.value
      }
    })
    editingItem.value = null
    const places: string[] = []
    if (toNav.value) places.push(d.nav === 'exists' ? '首页导航（已存在）' : '首页导航')
    if (toDirectory.value) places.push(d.directory === 'exists' ? '分类目录（已存在）' : '分类目录')
    flash(`已收录到${places.join(' + ')}`)
    await load()
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || e?.data?.message || '操作失败'
    msgKind.value = 'err'
  } finally {
    acting.value = false
  }
}

async function reject(item: any) {
  if (!confirm(`确定拒绝「${item.name}」？`)) return
  msg.value = ''
  try {
    await $fetch('/api/admin/submissions', { method: 'POST', body: { id: item.id, action: 'reject' } })
    flash('已拒绝')
    await load()
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || e?.data?.message || '操作失败'
    msgKind.value = 'err'
  }
}

onMounted(async () => {
  await loadCategories()
  await load()
})

const filters = [
  { v: 'pending', label: '待审核' },
  { v: 'approved', label: '已收录' },
  { v: 'rejected', label: '已拒绝' },
  { v: '', label: '全部' }
]

function setStatus(v: string) { status.value = v; page.value = 1; load() }
function go(p: number) { page.value = p; load() }
function statusText(s: string) {
  return s === 'pending' ? '待审核' : s === 'approved' ? '已收录' : '已拒绝'
}
function targetText(item: any) {
  if (item.target === 'both') return '首页 + 目录'
  const label = item.target === 'directory' ? '目录' : '导航'
  return item.status === 'pending' ? `申请${label}` : `${label}收录`
}
function iconOf(url: string) {
  try { return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}` } catch { return '' }
}
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex flex-col gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex gap-1 p-1 rounded-xl bg-card2 border border-line overflow-x-auto">
          <button
            v-for="f in filters"
            :key="f.v"
            class="h-8 px-3 rounded-lg text-[12.5px] whitespace-nowrap transition-colors"
            :class="status === f.v ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:text-ink'"
            @click="setStatus(f.v)"
          >{{ f.label }}</button>
        </div>
        <div class="flex-1" />
        <span class="text-[12.5px] text-ink2">共 {{ total }} 条</span>
      </div>
      <form class="flex gap-2" @submit.prevent="page = 1; load()">
        <input v-model="kw" class="field grow sm:max-w-[280px]" placeholder="搜索名称或网址" />
        <button class="btn shrink-0" type="submit">搜索</button>
      </form>
      <p v-if="msg" class="text-[13px]" :class="msgKind === 'err' ? 'text-danger' : 'text-success'">{{ msg }}</p>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">暂无记录</div>
    <div v-else class="flex flex-col gap-3">
      <div v-for="it in items" :key="it.id" class="card p-4">
        <div class="flex items-start gap-3">
          <SiteIcon :src="it.icon || iconOf(it.url)" :name="it.name" :url="it.url" class="w-9 h-9 rounded-xl shrink-0 text-[13px]" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-medium text-[14px]">{{ it.name }}</span>
              <span class="chip !text-[10px]" :class="{ 'text-warning': it.status === 'pending', 'text-success': it.status === 'approved' }">{{ statusText(it.status) }}</span>
              <span class="chip !text-[10px]">{{ targetText(it) }}</span>
              <span v-if="it.grp" class="chip !text-[10px]">{{ it.grp }}</span>
            </div>
            <a :href="it.url" target="_blank" rel="noopener nofollow" class="block text-[12.5px] text-ink2 hover:text-ink truncate mt-0.5">{{ it.url }}</a>
            <p v-if="it.description" class="text-[12.5px] text-ink2 mt-1.5 line-clamp-2">{{ it.description }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
          <button v-if="it.status !== 'approved'" class="btn btn-sm btn-primary" @click="openReview(it)">审核收录</button>
          <button v-else class="btn btn-sm" @click="openEdit(it)">编辑信息</button>
          <button v-if="it.status !== 'approved'" class="btn btn-sm btn-ghost" @click="openEdit(it)">编辑</button>
          <a :href="it.url" target="_blank" rel="noopener nofollow" class="btn btn-sm btn-ghost">访问网站</a>
          <div class="flex-1" />
          <button v-if="it.status !== 'rejected'" class="btn btn-sm btn-ghost text-danger" @click="reject(it)">拒绝</button>
        </div>
      </div>
    </div>

    <AdminPager :page="page" :total="total" :size="size" @change="go" />

    <Teleport to="body">
      <div v-if="editingItem" class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" @click.self="!acting && (editingItem = null)">
        <div class="w-full sm:max-w-[560px] bg-card border border-line rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="font-semibold text-[15px]">{{ mode === 'review' ? '审核并修改' : '编辑提交信息' }}「{{ editingItem.name }}」</h3>
            <div class="flex-1" />
            <button class="btn btn-sm btn-ghost" :disabled="acting" @click="editingItem = null">关闭</button>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <label class="flex flex-col gap-1.5 sm:col-span-2">
              <span class="text-[12px] text-ink2">站点名称</span>
              <input v-model="form.name" class="field" maxlength="80" placeholder="站点名称" />
            </label>
            <label class="flex flex-col gap-1.5 sm:col-span-2">
              <span class="text-[12px] text-ink2">网址</span>
              <input v-model="form.url" class="field" inputmode="url" placeholder="https://..." />
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="text-[12px] text-ink2">分类</span>
              <select v-model="form.grp" class="field">
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="text-[12px] text-ink2">关键词</span>
              <input v-model="form.keywords" class="field" maxlength="300" placeholder="用逗号分隔" />
            </label>
            <label class="flex flex-col gap-1.5 sm:col-span-2">
              <span class="text-[12px] text-ink2">标题</span>
              <input v-model="form.title" class="field" maxlength="200" placeholder="SEO 标题" />
            </label>
            <label class="flex flex-col gap-1.5 sm:col-span-2">
              <span class="text-[12px] text-ink2">简介</span>
              <textarea v-model="form.description" class="field min-h-[84px]" maxlength="500" placeholder="站点简介" />
            </label>
          </div>

          <template v-if="mode === 'review'">
            <p class="text-[12.5px] text-ink2 mt-4 mb-2">选择收录位置，可同时收录到首页导航和分类目录。</p>
            <div class="flex flex-col gap-2">
              <label
                class="flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors"
                :class="toNav ? 'border-ink bg-accentsoft' : 'border-line bg-card'"
              >
                <input v-model="toNav" type="checkbox" class="mt-0.5 w-4 h-4 shrink-0 accent-current" />
                <span class="min-w-0">
                  <span class="block text-[13.5px] font-medium">收录到首页导航</span>
                  <span class="block text-[12px] leading-5 text-ink2 mt-0.5">加入首页「{{ form.grp }}」分组，分组不存在时自动创建。</span>
                </span>
              </label>
              <label
                class="flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors"
                :class="toDirectory ? 'border-ink bg-accentsoft' : 'border-line bg-card'"
              >
                <input v-model="toDirectory" type="checkbox" class="mt-0.5 w-4 h-4 shrink-0 accent-current" />
                <span class="min-w-0">
                  <span class="block text-[13.5px] font-medium">收录到分类目录</span>
                  <span class="block text-[12px] leading-5 text-ink2 mt-0.5">生成独立详情页，并自动进入 sitemap。</span>
                </span>
              </label>
            </div>
          </template>
          <p v-else class="text-[11.5px] text-ink3 mt-3">仅修改提交记录。已收录的导航和目录内容请在对应管理页调整。</p>

          <p v-if="msg" class="text-[12.5px] mt-2" :class="msgKind === 'err' ? 'text-danger' : 'text-success'">{{ msg }}</p>

          <div class="flex gap-2 mt-4">
            <button class="btn flex-1" :disabled="acting" @click="editingItem = null">取消</button>
            <button v-if="mode === 'review'" class="btn btn-primary flex-1" :disabled="acting || (!toNav && !toDirectory)" @click="confirmApprove">{{ acting ? '处理中…' : '确认收录' }}</button>
            <button v-else class="btn btn-primary flex-1" :disabled="acting" @click="saveEdit">{{ acting ? '保存中…' : '保存修改' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
