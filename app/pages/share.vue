<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { iconFor, hostOf } from '~/data/nav'

useSeoMeta({ title: '添加到 2077 导航', robots: 'noindex' })

const route = useRoute()
const { groups, loadLocal, addGroup, addLink, renameGroup } = useNav()

const url = ref('')
const name = ref('')
const icon = ref('')
const groupId = ref('')
const busy = ref(false)
const msg = ref('')

function extract(input: string): string {
  const m = /https?:\/\/[^\s"'<>]+/i.exec(String(input || ''))
  return m ? m[0] : ''
}

function ensureGroup(nameText: string): string {
  const hit = groups.value.find(g => g.name === nameText)
  if (hit) return hit.id
  addGroup()
  const g = groups.value[groups.value.length - 1]
  renameGroup(g.id, nameText)
  return g.id
}

async function fetchMeta() {
  if (!/^https?:\/\//i.test(url.value)) return
  busy.value = true
  try {
    const d: any = await $fetch('/api/meta', { method: 'POST', body: { url: url.value } })
    const m = d.meta || {}
    if (!name.value.trim()) name.value = String(m.title || '').split(/[-_|·—]/)[0].trim() || m.host || hostOf(url.value)
    icon.value = m.host ? `/api/icon?url=${encodeURIComponent(m.host)}` : iconFor(url.value)
  } catch {
    if (!name.value.trim()) name.value = hostOf(url.value)
    icon.value = iconFor(url.value)
  } finally {
    busy.value = false
  }
}

function add() {
  if (!/^https?:\/\//i.test(url.value)) {
    msg.value = '请输入有效网址'
    return
  }
  const gid = groupId.value || ensureGroup('导入')
  const g = groups.value.find(x => x.id === gid)
  if (!g) return
  if (g.links.some(l => l.url === url.value)) {
    msg.value = '该网址已在分组中'
    return
  }
  addLink(g.id, {
    name: name.value.trim() || hostOf(url.value),
    url: url.value,
    icon: icon.value || iconFor(url.value)
  })
  msg.value = '已添加，正在返回首页…'
  setTimeout(() => navigateTo('/'), 500)
}

onMounted(async () => {
  await loadLocal()
  groupId.value = groups.value[0]?.id || ''
  const q = route.query
  const raw = String(q.url || '') || extract(String(q.text || '')) || extract(String(q.title || ''))
  if (raw) {
    url.value = raw
    await fetchMeta()
  }
})
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-10 sm:py-14 flex justify-center">
    <div class="w-full max-w-[520px] animate-fade-up">
      <header class="mb-5">
        <h1 class="text-xl font-semibold">添加到 2077 导航</h1>
        <p class="text-[13px] text-ink2 mt-1">来自系统分享面板的网址会先在这里确认，再写入你的本地导航。</p>
      </header>

      <div class="card p-4 sm:p-5 flex flex-col gap-3">
        <div>
          <label class="block text-[12.5px] text-ink2 mb-1.5" for="share-url">网址</label>
          <input id="share-url" v-model="url" class="field" placeholder="https://example.com" inputmode="url" autocapitalize="off" @blur="fetchMeta" />
        </div>
        <div>
          <label class="block text-[12.5px] text-ink2 mb-1.5" for="share-name">名称</label>
          <input id="share-name" v-model="name" class="field" maxlength="60" placeholder="留空自动抓取" />
        </div>
        <div>
          <label class="block text-[12.5px] text-ink2 mb-1.5" for="share-group">添加到分组</label>
          <select id="share-group" v-model="groupId" class="field !h-10">
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>

        <p v-if="busy" class="text-[12px] text-ink2">正在抓取站点信息…</p>
        <p v-if="msg" class="text-[12px]" :class="msg.startsWith('已添加') ? 'text-success' : 'text-danger'">{{ msg }}</p>

        <div class="flex items-center justify-between gap-2 pt-1">
          <NuxtLink to="/" class="btn btn-sm btn-ghost">返回首页</NuxtLink>
          <button class="btn btn-sm btn-primary min-w-[96px]" :disabled="busy || !url.trim()" @click="add">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>
