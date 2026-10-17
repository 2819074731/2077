<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const status = ref('pending')
const kw = ref('')
const loading = ref(false)
const msg = ref('')
const size = 20

const navGroups = ref<string[]>([])
const dirCategories = ref<string[]>([])
const reviewing = ref<any>(null)
const mode = ref<'nav' | 'directory'>('nav')
const groupName = ref('')
const category = ref('')
const acting = ref(false)

useSeoMeta({ title: '收录审核 · 2077 管理后台', robots: 'noindex' })

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

async function loadOptions() {
  try {
    const d: any = await $fetch('/api/admin/nav')
    navGroups.value = (d.groups || []).map((g: any) => g.name)
  } catch {}
  try {
    const d: any = await $fetch('/api/admin/directory?size=1')
    dirCategories.value = (d.categories || []).map((c: any) => c.category)
  } catch {}
}

function openReview(item: any, target: 'nav' | 'directory') {
  reviewing.value = item
  mode.value = target
  groupName.value = item.grp || navGroups.value[0] || '收录站点'
  category.value = item.grp || dirCategories.value[0] || '其他'
  msg.value = ''
}

async function confirmApprove() {
  const item = reviewing.value
  if (!item || acting.value) return
  acting.value = true
  msg.value = ''
  try {
    await $fetch('/api/admin/submissions', {
      method: 'POST',
      body: {
        id: item.id,
        action: 'approve',
        target: mode.value,
        group: groupName.value,
        category: category.value
      }
    })
    reviewing.value = null
    msg.value = mode.value === 'directory' ? '已收录到分类目录' : '已收录到首页导航'
    setTimeout(() => (msg.value = ''), 1800)
    await load()
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || e?.data?.message || '操作失败'
  } finally {
    acting.value = false
  }
}

async function reject(item: any) {
  if (!confirm(`确定拒绝「${item.name}」？`)) return
  msg.value = ''
  try {
    await $fetch('/api/admin/submissions', { method: 'POST', body: { id: item.id, action: 'reject' } })
    msg.value = '已拒绝'
    setTimeout(() => (msg.value = ''), 1600)
    await load()
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || e?.data?.message || '操作失败'
  }
}

onMounted(() => {
  load()
  loadOptions()
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
      <p v-if="msg" class="text-[13px] text-ink2">{{ msg }}</p>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">暂无记录</div>
    <div v-else class="flex flex-col gap-3">
      <div v-for="it in items" :key="it.id" class="card p-4">
        <div class="flex items-start gap-3">
          <img :src="iconOf(it.url)" alt="" class="w-9 h-9 rounded-xl shrink-0" referrerpolicy="no-referrer" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-medium text-[14px]">{{ it.name }}</span>
              <span class="chip !text-[10px]" :class="{ 'text-warning': it.status === 'pending', 'text-success': it.status === 'approved' }">{{ statusText(it.status) }}</span>
              <span class="chip !text-[10px]">{{ it.target === 'directory' ? '申请目录' : '申请导航' }}</span>
              <span v-if="it.grp" class="chip !text-[10px]">{{ it.grp }}</span>
            </div>
            <a :href="it.url" target="_blank" rel="noopener nofollow" class="block text-[12.5px] text-ink2 hover:text-ink truncate mt-0.5">{{ it.url }}</a>
            <p v-if="it.description" class="text-[12.5px] text-ink2 mt-1.5 line-clamp-2">{{ it.description }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
          <button v-if="it.status !== 'approved'" class="btn btn-sm btn-primary" @click="openReview(it, 'nav')">收录到导航</button>
          <button v-if="it.status !== 'approved'" class="btn btn-sm" @click="openReview(it, 'directory')">收录到目录</button>
          <a :href="it.url" target="_blank" rel="noopener nofollow" class="btn btn-sm btn-ghost">访问网站</a>
          <div class="flex-1" />
          <button v-if="it.status !== 'rejected'" class="btn btn-sm btn-ghost text-danger" @click="reject(it)">拒绝</button>
        </div>
      </div>
    </div>

    <AdminPager :page="page" :total="total" :size="size" @change="go" />

    <Teleport to="body">
      <div v-if="reviewing" class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" @click.self="!acting && (reviewing = null)">
        <div class="w-full sm:max-w-[480px] bg-card border border-line rounded-t-2xl sm:rounded-2xl p-4 sm:p-5">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="font-semibold text-[15px]">收录「{{ reviewing.name }}」</h3>
            <div class="flex-1" />
            <button class="btn btn-sm btn-ghost" :disabled="acting" @click="reviewing = null">关闭</button>
          </div>
          <div class="grid grid-cols-2 gap-2 mb-3">
            <button class="btn justify-center" :class="mode === 'nav' ? 'btn-primary' : 'btn-ghost'" @click="mode = 'nav'">首页导航</button>
            <button class="btn justify-center" :class="mode === 'directory' ? 'btn-primary' : 'btn-ghost'" @click="mode = 'directory'">分类目录</button>
          </div>
          <label class="block text-[12.5px] text-ink2 mb-1">{{ mode === 'directory' ? '目录分类' : '目标分组' }}</label>
          <input v-if="mode === 'nav'" v-model="groupName" class="field" list="nav-groups" placeholder="选择或输入分组名" />
          <input v-else v-model="category" class="field" list="dir-categories" placeholder="选择或输入分类名" />
          <datalist id="nav-groups"><option v-for="g in navGroups" :key="g" :value="g" /></datalist>
          <datalist id="dir-categories"><option v-for="c in dirCategories" :key="c" :value="c" /></datalist>
          <p class="text-[11.5px] text-ink3 mt-2">
            {{ mode === 'directory' ? '将生成独立详情页 /site/{id}.html，并自动进入 sitemap。' : '将加入首页对应分组，不生成详情页。' }}
          </p>
          <p v-if="msg" class="text-[12.5px] text-danger mt-2">{{ msg }}</p>
          <div class="flex gap-2 mt-4">
            <button class="btn flex-1" :disabled="acting" @click="reviewing = null">取消</button>
            <button class="btn btn-primary flex-1" :disabled="acting" @click="confirmApprove">{{ acting ? '处理中…' : '确认收录' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
