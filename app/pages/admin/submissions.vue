<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const status = ref('pending')
const kw = ref('')
const loading = ref(false)
const msg = ref('')
const size = 20

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

async function act(item: any, action: string) {
  msg.value = ''
  try {
    await $fetch('/api/admin/submissions', { method: 'POST', body: { id: item.id, action, group: item.grp } })
    items.value = items.value.filter(i => i.id !== item.id)
    total.value = Math.max(0, total.value - 1)
    msg.value = action === 'approve' ? '已收录' : '已拒绝'
    setTimeout(() => (msg.value = ''), 1600)
  } catch (e: any) {
    msg.value = e?.data?.message || '操作失败'
  }
}

onMounted(load)

const filters = [
  { v: 'pending', label: '待审核' },
  { v: 'approved', label: '已收录' },
  { v: 'rejected', label: '已拒绝' },
  { v: '', label: '全部' }
]

function setStatus(v: string) { status.value = v; page.value = 1; load() }
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size)))
function go(p: number) { page.value = p; load() }
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="flex gap-1 p-1 rounded-xl bg-card2 border border-line">
        <button
          v-for="f in filters"
          :key="f.v"
          class="h-7 px-3 rounded-lg text-[12.5px] transition-colors"
          :class="status === f.v ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:text-ink'"
          @click="setStatus(f.v)"
        >{{ f.label }}</button>
      </div>
      <div class="flex-1" />
      <input v-model="kw" class="field !h-9 !w-52" placeholder="搜索名称/网址" @keyup.enter="page = 1; load()" />
      <button class="btn btn-sm" @click="page = 1; load()">搜索</button>
    </div>

    <p v-if="msg" class="text-[13px] text-ink2 mb-3">{{ msg }}</p>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">暂无记录</div>
    <div v-else class="flex flex-col gap-3">
      <div v-for="it in items" :key="it.id" class="card p-4">
        <div class="flex items-start gap-3">
          <img :src="`/api/icon?url=${encodeURIComponent(new URL(it.url).hostname)}`" alt="" class="w-8 h-8 rounded-lg shrink-0" referrerpolicy="no-referrer" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-[14px]">{{ it.name }}</span>
              <span class="chip">{{ it.status }}</span>
              <span v-if="it.grp" class="chip">{{ it.grp }}</span>
            </div>
            <a :href="it.url" target="_blank" rel="noopener" class="block text-[12.5px] text-ink2 hover:text-ink truncate mt-0.5">{{ it.url }}</a>
            <p v-if="it.description" class="text-[12.5px] text-ink2 mt-1.5 line-clamp-2">{{ it.description }}</p>
            <p v-if="it.keywords" class="text-[11.5px] text-ink3 mt-1 truncate">{{ it.keywords }}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <template v-if="it.status !== 'approved'">
              <button class="btn btn-sm btn-primary" @click="act(it, 'approve')">收录</button>
            </template>
            <template v-if="it.status !== 'rejected'">
              <button class="btn btn-sm btn-ghost" @click="act(it, 'reject')">拒绝</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-5">
      <button class="btn btn-sm" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <span class="text-[12.5px] text-ink2">{{ page }} / {{ totalPages }}</span>
      <button class="btn btn-sm" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
    </div>
  </div>
</template>
