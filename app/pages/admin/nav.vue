<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ALink { name: string; url: string; icon?: string }
interface AGroup { name: string; links: ALink[]; recommended?: boolean }

const groups = ref<AGroup[]>([])
const recommended = ref<ALink[]>([])
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

useSeoMeta({ title: '导航管理 · 2077 管理后台', robots: 'noindex' })

onMounted(async () => {
  try {
    const d: any = await $fetch('/api/admin/nav')
    groups.value = d.groups || []
    recommended.value = d.recommended || []
  } finally {
    loading.value = false
  }
})

function addGroup() { groups.value.push({ name: '新分组', links: [] }) }
function removeGroup(i: number) { groups.value.splice(i, 1) }
function addLink(g: AGroup) { g.links.push({ name: '', url: '' }) }
function removeLink(g: AGroup, i: number) { g.links.splice(i, 1) }
function moveLink(g: AGroup, i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= g.links.length) return
  const [it] = g.links.splice(i, 1)
  g.links.splice(j, 0, it)
}
function moveGroup(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= groups.value.length) return
  const [it] = groups.value.splice(i, 1)
  groups.value.splice(j, 0, it)
}

function addRec() { recommended.value.push({ name: '', url: '' }) }
function removeRec(i: number) { recommended.value.splice(i, 1) }
function moveRec(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= recommended.value.length) return
  const [it] = recommended.value.splice(i, 1)
  recommended.value.splice(j, 0, it)
}

async function save() {
  saving.value = true
  msg.value = ''
  try {
    const d: any = await $fetch('/api/admin/nav', {
      method: 'PUT',
      body: { groups: groups.value, recommended: recommended.value }
    })
    groups.value = d.groups
    recommended.value = d.recommended
    msg.value = '已保存'
    setTimeout(() => (msg.value = ''), 1600)
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || e?.data?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function exportJson() {
  window.open('/api/admin/nav/export', '_blank')
}

async function importJson(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    const d: any = await $fetch('/api/admin/nav/import', { method: 'POST', body: { data } })
    groups.value = d.groups
    recommended.value = d.recommended
    msg.value = '已导入'
    setTimeout(() => (msg.value = ''), 1600)
  } catch (err: any) {
    msg.value = err?.data?.statusMessage || err?.message || '导入失败'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <p class="text-[13px] text-ink2 flex-1 min-w-[220px]">维护站点默认导航分组，前台未登录用户将看到这里的配置。推荐站点按网址匹配，命中后在各分类内置顶展示。</p>
      <span v-if="msg" class="text-[12.5px] text-ink2">{{ msg }}</span>
      <button class="btn btn-sm" @click="exportJson">导出</button>
      <button class="btn btn-sm" @click="fileInput?.click()">导入</button>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importJson" />
      <button class="btn btn-sm" @click="addGroup">+ 分组</button>
      <button class="btn btn-sm btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else class="flex flex-col gap-4">
      <section class="card p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="h-3.5 w-1 rounded-full accent-bar" />
          <span class="font-medium text-[13.5px]">推荐站点</span>
          <span class="chip">{{ recommended.length }}</span>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost" @click="addRec">+ 推荐</button>
        </div>
        <p class="text-[12px] text-ink3 mb-2">按网址匹配，命中后在各分类内置顶并加「荐」标；分类中没有的网址不会单独展示。</p>
        <div v-if="!recommended.length" class="text-[12.5px] text-ink3 py-3 text-center border border-dashed border-line rounded-xl">暂无推荐站点</div>
        <div v-for="(l, li) in recommended" :key="li" class="flex flex-col sm:flex-row gap-2 mb-2">
          <input v-model="l.name" class="field sm:!w-40" placeholder="名称" />
          <input v-model="l.url" class="field grow" placeholder="https://..." />
          <div class="flex gap-1">
            <button class="btn btn-sm btn-ghost !px-2" :disabled="li === 0" @click="moveRec(li, -1)">↑</button>
            <button class="btn btn-sm btn-ghost !px-2" :disabled="li === recommended.length - 1" @click="moveRec(li, 1)">↓</button>
            <button class="btn btn-sm btn-ghost text-ink2 !px-2" @click="removeRec(li)">删</button>
          </div>
        </div>
      </section>

      <section v-for="(g, gi) in groups" :key="gi" class="card p-4">
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <input v-model="g.name" class="field !h-9 !w-48 font-medium" placeholder="分组名称" />
          <label class="flex items-center gap-1.5 text-[12.5px] text-ink2 cursor-pointer">
            <input type="checkbox" v-model="g.recommended" /> 首页优先展示
          </label>
          <span class="chip">{{ g.links.length }}</span>
          <div class="flex-1" />
          <button class="btn btn-sm btn-ghost !px-2" :disabled="gi === 0" @click="moveGroup(gi, -1)">↑</button>
          <button class="btn btn-sm btn-ghost !px-2" :disabled="gi === groups.length - 1" @click="moveGroup(gi, 1)">↓</button>
          <button class="btn btn-sm btn-ghost" @click="addLink(g)">+ 链接</button>
          <button class="btn btn-sm btn-ghost text-ink2" @click="removeGroup(gi)">删除分组</button>
        </div>
        <div v-if="!g.links.length" class="text-[12.5px] text-ink3 py-3 text-center border border-dashed border-line rounded-xl">暂无链接</div>
        <div v-for="(l, li) in g.links" :key="li" class="flex flex-col sm:flex-row gap-2 mb-2">
          <input v-model="l.name" class="field sm:!w-40" placeholder="名称" />
          <input v-model="l.url" class="field grow" placeholder="https://..." />
          <div class="flex gap-1">
            <button class="btn btn-sm btn-ghost !px-2" :disabled="li === 0" @click="moveLink(g, li, -1)">↑</button>
            <button class="btn btn-sm btn-ghost !px-2" :disabled="li === g.links.length - 1" @click="moveLink(g, li, 1)">↓</button>
            <button class="btn btn-sm btn-ghost text-ink2 !px-2" @click="removeLink(g, li)">删</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
