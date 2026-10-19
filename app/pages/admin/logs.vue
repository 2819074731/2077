<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface LogRow {
  id: number
  user_id: number
  username: string
  action: string
  target: string
  detail: any
  ip: string
  created_at: string
}

const items = ref<LogRow[]>([])
const total = ref(0)
const page = ref(1)
const size = 20
const action = ref('')
const actions = ref<Array<{ action: string; n: number }>>([])
const loading = ref(true)

useSeoMeta({ title: '操作日志 · 2077 管理后台', robots: 'noindex' })

const labels: Record<string, string> = {
  'nav.save': '保存导航',
  'nav.import': '导入导航',
  'directory.category': '目录改分类'
}

const pages = computed(() => Math.max(1, Math.ceil(total.value / size)))

async function load() {
  loading.value = true
  try {
    const qs = new URLSearchParams({ page: String(page.value), size: String(size) })
    if (action.value) qs.set('action', action.value)
    const d: any = await $fetch(`/api/admin/logs?${qs}`)
    items.value = d.items || []
    total.value = Number(d.total || 0)
    actions.value = d.actions || []
  } finally {
    loading.value = false
  }
}

function fmt(ts: string) {
  try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }) } catch { return ts }
}

function detailText(detail: any) {
  if (detail == null) return ''
  try { return JSON.stringify(detail, null, 2) } catch { return String(detail) }
}

function changeCount(row: LogRow): number {
  const detail = row.detail || {}
  return Number(detail.sync?.created || 0) + Number(detail.sync?.updated || 0)
    + (Array.isArray(detail.urlChanges) ? detail.urlChanges.length : 0)
    + Number(detail.navSync?.moved || 0)
}

watch([page, action], () => load())
onMounted(load)
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <select v-model="action" class="field !w-auto max-w-[200px]" @change="page = 1">
        <option value="">全部操作</option>
        <option v-for="a in actions" :key="a.action" :value="a.action">
          {{ labels[a.action] || a.action }}（{{ a.n }}）
        </option>
      </select>
      <span class="text-[12.5px] text-ink2">共 {{ total }} 条记录</span>
      <button class="btn btn-sm btn-ghost ml-auto" :disabled="loading" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">暂无操作记录</div>
    <div v-else class="card overflow-hidden divide-y divide-line">
      <details v-for="row in items" :key="row.id" class="group">
        <summary class="px-4 py-3 cursor-pointer list-none flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-card2/60">
          <span class="chip !text-[11px]">{{ labels[row.action] || row.action }}</span>
          <span class="text-[13px] font-medium">{{ row.username || '系统' }}</span>
          <span v-if="row.target" class="text-[12px] text-ink2">#{{ row.target }}</span>
          <span v-if="changeCount(row)" class="text-[12px] text-success">影响 {{ changeCount(row) }} 项</span>
          <span class="text-[12px] text-ink3 ml-auto">{{ fmt(row.created_at) }}</span>
          <span class="w-full sm:w-auto text-[11.5px] text-ink3">{{ row.ip }}</span>
        </summary>
        <pre class="px-4 pb-3 text-[11.5px] leading-relaxed text-ink2 whitespace-pre-wrap break-all">{{ detailText(row.detail) || '无详情' }}</pre>
      </details>
    </div>

    <div v-if="pages > 1" class="flex items-center justify-center gap-2 mt-4">
      <button class="btn btn-sm" :disabled="page <= 1 || loading" @click="page--">上一页</button>
      <span class="text-[12.5px] text-ink2">{{ page }} / {{ pages }}</span>
      <button class="btn btn-sm" :disabled="page >= pages || loading" @click="page++">下一页</button>
    </div>
  </div>
</template>
