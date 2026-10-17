<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { CloudLink } from '~/composables/useAuth'
const { user, refresh, logout, saveCloudLinks } = useAuth()
const { pushToCloud, pullFromCloud, resetAll, syncMsg } = useNav()

const links = ref<CloudLink[]>([])
const saving = ref(false)
const savedMsg = ref('')

useSeoMeta({ title: '我的设置 · 2077 导航', robots: 'noindex' })

onMounted(async () => {
  await refresh()
  if (!user.value) { await navigateTo('/login'); return }
  links.value = (user.value.links || []).map(l => ({ ...l }))
})

function addRow() { links.value.push({ name: '', url: '', public: true }) }
function removeRow(i: number) { links.value.splice(i, 1) }

async function save() {
  saving.value = true
  savedMsg.value = ''
  try {
    const clean = links.value
      .filter(l => l.name && l.url)
      .map((l, i) => ({ name: l.name, url: l.url, icon: l.icon, sort: i, public: l.public !== false }))
    await saveCloudLinks(clean)
    savedMsg.value = '已保存'
    setTimeout(() => (savedMsg.value = ''), 1800)
  } catch (e: any) {
    savedMsg.value = e?.data?.statusMessage || e?.data?.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-10 animate-fade-up">
    <header class="flex items-center gap-3.5 mb-7">
      <span class="grid place-items-center w-12 h-12 rounded-2xl bg-ink text-bg text-lg font-semibold shadow-soft">{{ (user?.nickname || 'U')[0].toUpperCase() }}</span>
      <div class="min-w-0">
        <h1 class="text-xl font-semibold truncate">{{ user?.nickname || '我的设置' }}</h1>
        <p class="text-[13px] text-ink2 truncate">
          <NuxtLink :to="`/u/${user?.slug}`" class="text-accent hover:underline">/u/{{ user?.slug }}</NuxtLink>
          <span class="mx-1.5 opacity-40">·</span>{{ user?.email }}
        </p>
      </div>
      <div class="flex-1" />
      <button class="btn btn-sm btn-ghost" @click="logout().then(() => navigateTo('/'))">退出登录</button>
    </header>

    <section class="card p-5 mb-6">
      <div class="flex items-center gap-2.5 mb-3">
        <span class="h-4 w-1 rounded-full accent-bar" />
        <h2 class="font-semibold">导航配置同步</h2>
        <div class="flex-1" />
        <span v-if="syncMsg" class="text-[12px] text-ink2 mr-1">{{ syncMsg }}</span>
        <button class="btn btn-sm" @click="pullFromCloud">从云端拉取</button>
        <button class="btn btn-sm" @click="pushToCloud">推送到云端</button>
        <button class="btn btn-sm btn-ghost" @click="resetAll">重置</button>
      </div>
      <p class="text-[13px] text-ink2">在首页开启「自定义」编辑的分组与链接，会在这里与云端双向同步。</p>
    </section>

    <section class="card p-5">
      <div class="flex items-center gap-2.5 mb-4">
        <span class="h-4 w-1 rounded-full accent-bar" />
        <div>
          <h2 class="font-semibold">我的云端网址</h2>
          <p class="text-[13px] text-ink2">公开的网址会展示在你的个人主页。</p>
        </div>
        <div class="flex-1" />
        <span v-if="savedMsg" class="text-[12px] text-ink2 mr-1">{{ savedMsg }}</span>
        <button class="btn btn-sm" @click="addRow">+ 添加</button>
      </div>

      <div v-if="!links.length" class="text-[13px] text-ink2 py-6 text-center border border-dashed border-line rounded-xl">
        还没有云端网址，点「添加」创建。
      </div>

      <div v-for="(l, i) in links" :key="i" class="flex flex-col sm:flex-row gap-2 mb-2.5">
        <input v-model="l.name" class="field sm:!w-44" placeholder="名称" />
        <input v-model="l.url" class="field grow" placeholder="https://..." />
        <label class="flex items-center gap-1.5 text-[13px] text-ink2 select-none px-1.5 whitespace-nowrap">
          <input type="checkbox" v-model="l.public" /> 公开
        </label>
        <button class="btn btn-sm btn-ghost text-ink2" @click="removeRow(i)">删除</button>
      </div>

      <div class="mt-4">
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
      </div>
    </section>
  </div>
</template>
