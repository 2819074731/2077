<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const kw = ref('')
const role = ref('')
const loading = ref(false)
const msg = ref('')
const size = 20

useSeoMeta({ title: '用户管理 · 2077 管理后台', robots: 'noindex' })

async function load() {
  loading.value = true
  try {
    const qs = new URLSearchParams({ page: String(page.value), size: String(size) })
    if (kw.value.trim()) qs.set('q', kw.value.trim())
    if (role.value) qs.set('role', role.value)
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
    msg.value = action === 'delete' ? '用户已删除' : '角色已更新'
    setTimeout(() => (msg.value = ''), 1600)
    await load()
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || e?.data?.message || '操作失败'
  }
}

onMounted(load)
function go(p: number) { page.value = p; load() }
function search() { page.value = 1; load() }
function fmtDate(v: string) {
  try { return new Date(v).toLocaleDateString('zh-CN') } catch { return '' }
}
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex flex-col gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <form class="flex gap-2 flex-1 min-w-[220px]" @submit.prevent="search">
          <input v-model="kw" class="field grow sm:max-w-[300px]" placeholder="搜索邮箱、昵称或短链" />
          <button class="btn shrink-0" type="submit">搜索</button>
        </form>
        <select v-model="role" class="field !w-auto" @change="search">
          <option value="">全部用户</option>
          <option value="admin">管理员</option>
          <option value="user">普通用户</option>
        </select>
        <span class="text-[12.5px] text-ink2 ml-auto">共 {{ total }} 人</span>
      </div>
      <p v-if="msg" class="text-[12.5px] text-ink2">{{ msg }}</p>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!items.length" class="card p-8 text-center text-ink2 text-[13px]">暂无用户</div>
    <div v-else class="card overflow-hidden divide-y divide-line">
      <div v-for="u in items" :key="u.id" class="p-4">
        <div class="flex items-start gap-3">
          <span class="grid place-items-center w-9 h-9 rounded-full bg-ink text-bg text-[12px] font-semibold shrink-0">{{ (u.nickname || 'U')[0].toUpperCase() }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-medium text-[13.5px]">{{ u.nickname || '—' }}</span>
              <span v-if="u.is_admin" class="chip !text-[10px]">管理员</span>
            </div>
            <p class="text-[11.5px] text-ink2 truncate">{{ u.email }}</p>
            <p class="text-[11.5px] text-ink3 mt-0.5">/u/{{ u.slug }} · {{ u.links }} 个云端链接 · 注册于 {{ fmtDate(u.created_at) }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
          <NuxtLink :to="`/u/${u.slug}`" target="_blank" class="btn btn-sm btn-ghost">查看主页</NuxtLink>
          <button class="btn btn-sm" @click="act(u, 'toggle-admin')">{{ u.is_admin ? '取消管理员' : '设为管理员' }}</button>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost text-danger" @click="act(u, 'delete')">删除用户</button>
        </div>
      </div>
    </div>

    <AdminPager :page="page" :total="total" :size="size" @change="go" />
  </div>
</template>
