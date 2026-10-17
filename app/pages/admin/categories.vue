<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

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
const deleting = ref<CategoryRow | null>(null)
const moveTarget = ref('其他')
const deletingBusy = ref(false)
const moveOptions = computed(() => items.value.map(item => item.name).filter(name => name !== deleting.value?.name))

useSeoMeta({ title: '分类管理 · 2077 管理后台', robots: 'noindex' })

function flash(text: string, kind: 'ok' | 'err' = 'ok') {
  msg.value = text
  msgKind.value = kind
  setTimeout(() => { if (msg.value === text) msg.value = '' }, kind === 'err' ? 4800 : 2400)
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

async function doDelete(item: CategoryRow, moveTo?: string) {
  if (deletingBusy.value) return
  deletingBusy.value = true
  try {
    const d: any = await $fetch('/api/admin/categories', {
      method: 'POST',
      body: { action: 'delete', name: item.name, ...(moveTo ? { moveTo } : {}) }
    })
    deleting.value = null
    flash(d?.moved ? `已迁移 ${d.moved} 条数据并删除分类` : '分类已删除')
    await load()
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.data?.message || '删除失败', 'err')
  } finally {
    deletingBusy.value = false
  }
}

async function remove(item: CategoryRow) {
  if (item.name === '其他') return
  const used = item.directory + item.nav + item.submissions
  if (used === 0) {
    if (!confirm(`确定删除分类「${item.name}」？`)) return
    await doDelete(item)
    return
  }
  deleting.value = item
  moveTarget.value = items.value.some(row => row.name === '其他') ? '其他' : (items.value.find(row => row.name !== item.name)?.name || '')
}

async function confirmMoveDelete() {
  const item = deleting.value
  if (!item || !moveTarget.value) return
  await doDelete(item, moveTarget.value)
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

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (editing.value && !saving.value) editing.value = null
  else if (deleting.value && !deletingBusy.value) deleting.value = null
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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

    <div
      v-if="msg"
      class="fixed left-1/2 bottom-6 z-[80] w-[calc(100%-2rem)] max-w-[520px] -translate-x-1/2 rounded-xl border bg-bg px-4 py-3 text-[12.5px] shadow-soft"
      :class="msgKind === 'err' ? 'border-danger text-danger' : 'border-line text-success'"
      role="status"
    >{{ msg }}</div>

    <Teleport to="body">
      <div v-if="editing" role="dialog" aria-modal="true" class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" @click.self="!saving && (editing = null)">
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

    <Teleport to="body">
      <div v-if="deleting" role="dialog" aria-modal="true" class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" @click.self="!deletingBusy && (deleting = null)">
        <div class="w-full sm:max-w-[440px] bg-card border border-line rounded-t-2xl sm:rounded-2xl p-4 sm:p-5">
          <div class="flex items-center gap-2 mb-2">
            <h3 class="font-semibold text-[15px]">删除分类「{{ deleting.name }}」</h3>
            <div class="flex-1" />
            <button class="btn btn-sm btn-ghost" :disabled="deletingBusy" @click="deleting = null">关闭</button>
          </div>
          <p class="text-[12.5px] text-ink2 leading-relaxed">
            该分类还有 {{ deleting.directory + deleting.nav + deleting.submissions }} 条数据，直接删除会被拦截。选择一个目标分类，数据会一并迁移后再删除当前分类。
          </p>
          <div class="flex flex-wrap gap-1.5 mt-3">
            <span class="chip !text-[10px]">目录 {{ deleting.directory }}</span>
            <span class="chip !text-[10px]">导航 {{ deleting.nav }}</span>
            <span class="chip !text-[10px]">提交 {{ deleting.submissions }}</span>
          </div>
          <label class="flex flex-col gap-1.5 mt-4">
            <span class="text-[12px] text-ink2">迁移到</span>
            <select v-model="moveTarget" class="field" :disabled="deletingBusy">
              <option v-for="name in moveOptions" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <p class="text-[11.5px] text-ink3 mt-2">目录条目、导航链接和提交记录会迁移到目标分类；目标分类已有的同网址导航会自动去重。</p>
          <div class="flex gap-2 mt-4">
            <button class="btn flex-1" :disabled="deletingBusy" @click="deleting = null">取消</button>
            <button class="btn btn-primary flex-1" :disabled="deletingBusy || !moveTarget" @click="confirmMoveDelete">{{ deletingBusy ? '处理中…' : '迁移并删除' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
