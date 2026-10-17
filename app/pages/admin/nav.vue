<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ALink { name: string; url: string; icon?: string }
interface AGroup { name: string; links: ALink[] }

const groups = ref<AGroup[]>([])
const loading = ref(true)
const saving = ref(false)
const msg = ref('')

useSeoMeta({ title: '导航管理 · 2077 管理后台', robots: 'noindex' })

onMounted(async () => {
  try {
    const d: any = await $fetch('/api/admin/nav')
    groups.value = d.groups || []
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

async function save() {
  saving.value = true
  msg.value = ''
  try {
    const d: any = await $fetch('/api/admin/nav', { method: 'PUT', body: { groups: groups.value } })
    groups.value = d.groups
    msg.value = '已保存'
    setTimeout(() => (msg.value = ''), 1600)
  } catch (e: any) {
    msg.value = e?.data?.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex items-center gap-3 mb-4">
      <p class="text-[13px] text-ink2">维护站点默认导航分组，前台未登录用户将看到这里的配置。</p>
      <div class="flex-1" />
      <span v-if="msg" class="text-[12.5px] text-ink2">{{ msg }}</span>
      <button class="btn btn-sm" @click="addGroup">+ 分组</button>
      <button class="btn btn-sm btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else class="flex flex-col gap-4">
      <section v-for="(g, gi) in groups" :key="gi" class="card p-4">
        <div class="flex items-center gap-2 mb-3">
          <input v-model="g.name" class="field !h-9 !w-48 font-medium" placeholder="分组名称" />
          <span class="chip">{{ g.links.length }}</span>
          <div class="flex-1" />
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
