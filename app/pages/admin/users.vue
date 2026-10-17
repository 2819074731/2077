<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const kw = ref('')
const loading = ref(false)
const msg = ref('')
const size = 20

useSeoMeta({ title: '用户管理 · 2077 管理后台', robots: 'noindex' })

async function load() {
  loading.value = true
  try {
    const qs = new URLSearchParams({ page: String(page.value), size: String(size) })
    if (kw.value.trim()) qs.set('q', kw.value.trim())
    const d: any = await $fetch(`/api/admin/users?${qs}`)
    items.value = d.items
    total.value = d.total
  } finally {
    loading.value = false
  }
}

async function act(u: any, action: string) {
  msg.value = ''
  if (action === 'delete' && !confirm(`确定删除用户「${u.nickname || u.email}」及其数据？`)) return
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: { id: u.id, action } })
    if (action === 'delete') { items.value = items.value.filter(i => i.id !== u.id); total.value-- }
    else if (action === 'toggle-admin') { u.is_admin = u.is_admin ? 0 : 1 }
    msg.value = '操作成功'
    setTimeout(() => (msg.value = ''), 1600)
  } catch (e: any) {
    msg.value = e?.data?.message || '操作失败'
  }
}

onMounted(load)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size)))
function go(p: number) { page.value = p; load() }
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex items-center gap-2 mb-4">
      <input v-model="kw" class="field !h-9 !w-56" placeholder="搜索邮箱/昵称/短链" @keyup.enter="page = 1; load()" />
      <button class="btn btn-sm" @click="page = 1; load()">搜索</button>
      <div class="flex-1" />
      <span v-if="msg" class="text-[12.5px] text-ink2">{{ msg }}</span>
      <span class="text-[12.5px] text-ink2">共 {{ total }} 人</span>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">暂无用户</div>
    <div v-else class="card overflow-hidden">
      <div class="divide-y divide-line">
        <div v-for="u in items" :key="u.id" class="flex items-center gap-3 px-4 py-3">
          <span class="grid place-items-center w-8 h-8 rounded-full bg-ink text-bg text-[12px] font-semibold shrink-0">{{ (u.nickname || 'U')[0].toUpperCase() }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium text-[13.5px] truncate">{{ u.nickname || '—' }}</span>
              <span v-if="u.is_admin" class="chip !text-[10px] !h-5">管理员</span>
            </div>
            <span class="block text-[11.5px] text-ink2 truncate">{{ u.email }} · /u/{{ u.slug }} · {{ u.links }} 链接</span>
          </div>
          <div class="flex gap-2 shrink-0">
            <button class="btn btn-sm btn-ghost" @click="act(u, 'toggle-admin')">{{ u.is_admin ? '取消管理员' : '设为管理员' }}</button>
            <button class="btn btn-sm btn-ghost text-danger" @click="act(u, 'delete')">删除</button>
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
