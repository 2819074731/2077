<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface FLink { name: string; url: string; desc?: string; icon?: string }

const links = ref<FLink[]>([])
const loading = ref(true)
const saving = ref(false)
const msg = ref('')

useSeoMeta({ title: '友情链接 · 2077 管理后台', robots: 'noindex' })

onMounted(async () => {
  try {
    const d: any = await $fetch('/api/admin/friends')
    links.value = d.links || []
  } finally {
    loading.value = false
  }
})

function add() { links.value.push({ name: '', url: '', desc: '' }) }
function remove(i: number) { links.value.splice(i, 1) }
function move(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= links.value.length) return
  const [it] = links.value.splice(i, 1)
  links.value.splice(j, 0, it)
}

async function save() {
  saving.value = true
  msg.value = ''
  try {
    const d: any = await $fetch('/api/admin/friends', { method: 'PUT', body: { links: links.value } })
    links.value = d.links
    msg.value = '已保存'
    setTimeout(() => (msg.value = ''), 1600)
  } catch (e: any) {
    msg.value = e?.data?.statusMessage || e?.data?.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <p class="text-[13px] text-ink2 flex-1 min-w-[220px]">维护友情链接，将展示在前台页脚。填写网址后系统会自动抓取站点图标。</p>
      <span v-if="msg" class="text-[12.5px] text-ink2">{{ msg }}</span>
      <button class="btn btn-sm" @click="add">+ 链接</button>
      <button class="btn btn-sm btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>
    <div v-else-if="!links.length" class="card p-8 text-center text-ink2 text-[13px]">暂无友情链接，点击「+ 链接」添加。</div>
    <div v-else class="card p-4 flex flex-col gap-3">
      <div v-for="(l, i) in links" :key="i" class="flex flex-col sm:flex-row gap-2 items-start">
        <input v-model="l.name" class="field sm:!w-40" placeholder="站点名称" />
        <input v-model="l.url" class="field grow" placeholder="https://..." />
        <input v-model="l.desc" class="field sm:!w-48" placeholder="描述（可选）" />
        <div class="flex gap-1.5 shrink-0 w-full sm:w-auto">
          <button class="btn btn-sm btn-ghost flex-1 sm:flex-none" :disabled="i === 0" @click="move(i, -1)">上移</button>
          <button class="btn btn-sm btn-ghost flex-1 sm:flex-none" :disabled="i === links.length - 1" @click="move(i, 1)">下移</button>
          <button class="btn btn-sm btn-ghost text-ink2 flex-1 sm:flex-none" @click="remove(i)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
