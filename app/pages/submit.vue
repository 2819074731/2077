<script setup lang="ts">
import { computed, ref } from 'vue'
import { DIRECTORY_CATEGORIES } from '#shared/directory'

useSeoMeta({
  title: '提交收录 · 2077 导航',
  description: '提交你的网站收录到 2077 导航，支持一键抓取标题、描述与图标。'
})

const form = ref({ url: '', name: '', title: '', description: '', keywords: '', icon: '', group: '', target: 'nav' })
const loading = ref(false)
const fetching = ref(false)
const err = ref('')
const ok = ref(false)

const NAV_GROUPS = ['开发工具', 'AI 与模型', '社区资讯', '影音娱乐', '云与控制台', '运维监控', '学习文档', '效率工具', '购物生活', '社交平台', '其他']
const groupOptions = computed(() => form.value.target === 'directory' ? DIRECTORY_CATEGORIES : NAV_GROUPS)

function chooseTarget(target: 'nav' | 'directory') {
  form.value.target = target
  form.value.group = ''
}

async function fetchMeta() {
  err.value = ''
  if (!form.value.url.trim()) { err.value = '请先填写网址'; return }
  fetching.value = true
  try {
    const d: any = await $fetch('/api/meta', { method: 'POST', body: { url: form.value.url } })
    const m = d.meta
    form.value.title = m.title || ''
    form.value.description = m.description || ''
    form.value.keywords = m.keywords || ''
    form.value.icon = m.icon || ''
    if (!form.value.name && m.title) form.value.name = m.title.split(/[-_|·—]/)[0].trim().slice(0, 40)
    if (m.icon) form.value.icon = `/api/icon?url=${encodeURIComponent(m.host)}`
  } catch (e: any) {
    err.value = e?.data?.statusMessage || e?.data?.message || '抓取失败，请手动填写'
  } finally {
    fetching.value = false
  }
}

async function submit() {
  err.value = ''
  if (!form.value.name.trim() || !form.value.url.trim()) { err.value = '请填写站点名称和网址'; return }
  loading.value = true
  try {
    await $fetch('/api/submit', { method: 'POST', body: form.value })
    ok.value = true
  } catch (e: any) {
    err.value = e?.data?.statusMessage || e?.data?.message || '提交失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-12 flex justify-center">
    <div class="w-full max-w-[560px] animate-fade-up">
      <header class="mb-6 text-center">
        <h1 class="text-2xl font-bold tracking-tight">提交收录</h1>
        <p class="text-ink2 text-[13.5px] mt-1.5">推荐你的网站加入 2077 导航，可选择首页导航或分类目录。填写网址后点「一键获取」，自动抓取标题、描述与图标。</p>
      </header>

      <div v-if="ok" class="card p-8 text-center">
        <div class="grid place-items-center w-12 h-12 rounded-2xl bg-card2 mx-auto mb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h2 class="font-semibold text-lg">提交成功</h2>
        <p class="text-ink2 text-[13px] mt-1 mb-5">我们会在审核后收录你的站点，感谢推荐。</p>
        <NuxtLink to="/" class="btn btn-primary">返回首页</NuxtLink>
      </div>

      <form v-else class="card p-6 flex flex-col gap-3.5" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium">网址 <span class="text-danger">*</span></label>
          <div class="flex gap-2">
            <input v-model="form.url" class="field grow" placeholder="https://example.com" @keyup.enter.prevent="fetchMeta" />
            <button type="button" class="btn shrink-0" :disabled="fetching" @click="fetchMeta">
              <svg v-if="!fetching" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
              {{ fetching ? '抓取中…' : '一键获取' }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium">收录方式</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="btn justify-start !h-auto py-2.5"
              :class="form.target === 'nav' ? 'btn-primary' : 'btn-ghost'"
              @click="chooseTarget('nav')"
            >
              <span class="text-left">
                <span class="block text-[13px] font-medium">首页导航</span>
                <span class="block text-[11px] opacity-70 mt-0.5">审核标准较高，仅收录优质站点</span>
              </span>
            </button>
            <button
              type="button"
              class="btn justify-start !h-auto py-2.5"
              :class="form.target === 'directory' ? 'btn-primary' : 'btn-ghost'"
              @click="chooseTarget('directory')"
            >
              <span class="text-left">
                <span class="block text-[13px] font-medium">分类目录</span>
                <span class="block text-[11px] opacity-70 mt-0.5">收录到分类目录</span>
              </span>
            </button>
          </div>
          <p class="text-[11.5px] text-ink3 mt-0.5">首页导航审核标准较高，优先收录原创、长期稳定运营的站点。</p>
        </div>

        <div class="grid sm:grid-cols-2 gap-3.5">
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium">站点名称 <span class="text-danger">*</span></label>
            <input v-model="form.name" class="field" placeholder="例如 GitHub" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium">{{ form.target === 'directory' ? '目录分类' : '分组' }}</label>
            <select v-model="form.group" class="field">
              <option value="">未指定</option>
              <option v-for="g in groupOptions" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium">标题（TDK · Title）</label>
          <input v-model="form.title" class="field" placeholder="自动抓取，可修改" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium">描述（TDK · Description）</label>
          <textarea v-model="form.description" class="field !h-auto py-2 resize-none" rows="2" placeholder="自动抓取，可修改" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium">关键词（TDK · Keywords）</label>
          <input v-model="form.keywords" class="field" placeholder="自动抓取，可修改" />
        </div>

        <div v-if="form.icon" class="flex items-center gap-3 text-[13px] text-ink2">
          <img :src="form.icon" alt="icon" class="w-6 h-6 rounded" referrerpolicy="no-referrer" />
          <span class="truncate">已获取站点图标</span>
        </div>

        <p v-if="err" class="text-[13px] text-danger">{{ err }}</p>
        <button class="btn btn-primary h-10 mt-1" :disabled="loading">{{ loading ? '提交中…' : '提交收录' }}</button>
      </form>
    </div>
  </div>
</template>
