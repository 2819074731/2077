<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface CategoryRow {
  name: string
  directory: number
  nav: number
  submissions: number
  managed: boolean
}

const items = ref<CategoryRow[]>([])
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const msgKind = ref<'ok' | 'err'>('ok')

const editing = ref<{ mode: 'add' | 'rename'; from: string; name: string } | null>(null)
const formError = ref('')

useSeoMeta({ title: '分类管理 · 2077 管理后台', robots: 'noindex' })

function flash(text: string, kind: 'ok' | 'err' = 'ok') {
  msg.value = text
  msgKind.value = kind
  if (kind === 'ok') setTimeout(() => { if (msg.value === text) msg.value = '' }, 2200)
}

async function load() {
  loading.value = true
  try {
    const d: any = await $fetch('/api/admin/categories')
    items.value = d.categories || []
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editing.value = { mode: 'add', from: '', name: '' }
  formError.value = ''
}

function openRename(item: CategoryRow) {
  if (item.name === '其他') return
  editing.value = { mode: 'rename', from: item.name, name: item.name }
  formError.value = ''
}

async function save() {
  const e = editing.value
  if (!e || saving.value) return
  const name = e.name.trim()
  if (!name) { formError.value = '请填写分类名称'; return }
  saving.value = true
  formError.value = ''
  try {
    await $fetch('/api/admin/categories', {
      method: 'POST',
      body: e.mode === 'add'
        ? { action: 'add', name }
        : { action: 'rename', from: e.from, to: name }
    })
    editing.value = null
    flash(e.mode === 'add' ? '已新增分类' : '分类已重命名，相关数据已同步')
    await load()
  } catch (err: any) {
    formError.value = err?.data?.statusMessage || err?.data?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function remove(item: CategoryRow) {
  if (item.name === '其他') return
  if (!confirm(`确定删除分类「${item.name}」？`)) return
  try {
    await $fetch('/api/admin/categories', { method: 'POST', body: { action: 'delete', name: item.name } })
    flash('分类已删除')
    await load()
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.data?.message || '删除失败', 'err')
  }
}

async function move(item: CategoryRow, dir: number) {
  try {
    await $fetch('/api/admin/categories', { method: 'POST', body: { action: 'move', name: item.name, dir } })
    flash('分类顺序已更新')
    await load()
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.data?.message || '调整失败', 'err')
  }
}

onMounted(load)
</script>

<template>
  <div class="animate-fade-up">
    <section class="card p-3.5 sm:p-4 mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="min-w-0 flex-1">
          <h2 class="font-semibold text-[15px]">全局网站分类</h2>
          <p class="text-[12px] text-ink2 mt-1">首页导航、分类目录、收录审核与公开提交共用这套分类。分类顺序会同步到首页导航分组。</p>
        </div>
        <button class="btn btn-sm btn-primary shrink-0" @click="openAdd">新增分类</button>
      </div>
      <p v-if="msg" class="text-[12.5px] mt-2" :class="msgKind === 'err' ? 'text-danger' : 'text-success'">{{ msg }}</p>
    </section>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else class="card overflow-hidden divide-y divide-line">
      <div v-for="(item, index) in items" :key="item.name" class="p-3.5 sm:p-4">
        <div class="flex items-start gap-3">
          <span class="grid place-items-center w-9 h-9 rounded-xl border border-line bg-card2 text-[12px] font-semibold text-ink2 shrink-0">{{ item.name.slice(0, 1) }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-medium text-[13.5px]">{{ item.name }}</span>
              <span v-if="item.name === '其他'" class="chip !text-[10px]">系统保留</span>
              <span v-if="!item.managed" class="chip !text-[10px] text-warning">历史分类</span>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-1.5">
              <span class="chip !text-[10px]">目录 {{ item.directory }}</span>
              <span class="chip !text-[10px]">导航 {{ item.nav }}</span>
              <span class="chip !text-[10px]">提交 {{ item.submissions }}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
          <button class="btn btn-sm" @click="openRename(item)" :disabled="item.name === '其他'">重命名</button>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost" :disabled="index === 0" @click="move(item, -1)">上移</button>
          <button class="btn btn-sm btn-ghost" :disabled="index === items.length - 1" @click="move(item, 1)">下移</button>
          <button class="btn btn-sm btn-ghost text-danger" :disabled="item.name === '其他'" @click="remove(item)">删除</button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="editing" class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" @click.self="!saving && (editing = null)">
        <div class="w-full sm:max-w-[420px] bg-card border border-line rounded-t-2xl sm:rounded-2xl p-4 sm:p-5">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="font-semibold text-[15px]">{{ editing.mode === 'add' ? '新增分类' : '重命名分类' }}</h3>
            <div class="flex-1" />
            <button class="btn btn-sm btn-ghost" :disabled="saving" @click="editing = null">关闭</button>
          </div>
          <label class="flex flex-col gap-1.5">
            <span class="text-[12px] text-ink2">分类名称</span>
            <input v-model="editing.name" class="field" maxlength="30" autofocus placeholder="例如 开发工具" @keyup.enter="save" />
          </label>
          <p v-if="editing.mode === 'rename'" class="text-[11.5px] text-ink3 mt-2">重命名会同步更新目录、导航和提交记录中的分类。</p>
          <p v-if="formError" class="text-[12.5px] text-danger mt-2">{{ formError }}</p>
          <div class="flex gap-2 mt-4">
            <button class="btn flex-1" :disabled="saving" @click="editing = null">取消</button>
            <button class="btn btn-primary flex-1" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
