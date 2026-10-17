<script setup lang="ts">
import { ref, watch } from 'vue'
import { iconFor, hostOf } from '~/data/nav'
import { suggestGroupName } from '#shared/classify'

const open = defineModel<boolean>({ default: false })
const { groups, addGroup, addLink, renameGroup } = useNav()

const text = ref('')
const target = ref('__auto__')
const busy = ref(false)
const done = ref(0)
const total = ref(0)
const msg = ref('')

watch(open, (v) => {
  if (!v) return
  text.value = ''
  msg.value = ''
  busy.value = false
  done.value = 0
  total.value = 0
  target.value = groups.value[0]?.id || '__auto__'
})

function cleanTitle(title: string): string {
  return String(title || '').split(/[-_|·—]/)[0].trim().slice(0, 60)
}

function cleanUrl(raw: string): string {
  return String(raw || '').trim().replace(/[),.;:!?，。；：！？、）】]+$/g, '')
}

function extractUrls(): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const url = cleanUrl(raw)
    if (!/^https?:\/\//i.test(url)) return
    if (seen.has(url)) return
    seen.add(url)
    out.push(url)
  }
  const re = /https?:\/\/[^\s"'<>]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text.value))) push(m[0])
  for (const line of text.value.split(/\r?\n/)) {
    const t = line.trim()
    if (/^[\w.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(t)) push('https://' + t)
  }
  return out.slice(0, 30)
}

function ensureGroup(name: string): string {
  const hit = groups.value.find(g => g.name.toLowerCase() === name.toLowerCase())
  if (hit) return hit.id
  addGroup()
  const g = groups.value[groups.value.length - 1]
  renameGroup(g.id, name)
  return g.id
}

async function run() {
  if (busy.value) return
  const urls = extractUrls()
  if (!urls.length) {
    msg.value = '没有识别到网址'
    return
  }
  busy.value = true
  total.value = urls.length
  done.value = 0
  msg.value = ''
  let added = 0
  let skipped = 0

  for (const url of urls) {
    let name = hostOf(url)
    let icon = iconFor(url)
    let meta: any = null
    try {
      const d: any = await $fetch('/api/meta', { method: 'POST', body: { url } })
      meta = d.meta
      if (meta?.title) name = cleanTitle(meta.title) || name
      if (meta?.host) icon = `/api/icon?url=${encodeURIComponent(meta.host)}`
    } catch {}

    let gid = target.value
    if (gid === '__auto__') {
      const guessed = suggestGroupName(
        { name, url, title: meta?.title, description: meta?.description, keywords: meta?.keywords },
        groups.value.map(g => g.name)
      )
      gid = guessed ? ensureGroup(guessed) : ensureGroup('导入')
    } else if (gid === '__new__') {
      gid = ensureGroup('导入')
    }

    const g = groups.value.find(x => x.id === gid)
    if (!g) {
      skipped++
      done.value++
      continue
    }
    if (g.links.length >= 200 || g.links.some(l => l.url === url)) {
      skipped++
      done.value++
      continue
    }
    addLink(g.id, { name: name || hostOf(url), url, icon })
    added++
    done.value++
  }

  busy.value = false
  if (!added) {
    msg.value = '没有新增网址（可能已存在）'
    return
  }
  msg.value = `已导入 ${added} 条${skipped ? `，跳过 ${skipped} 条` : ''}`
  setTimeout(() => { open.value = false }, 900)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      @click.self="!busy && (open = false)"
    >
      <div class="card w-full sm:max-w-[540px] rounded-b-none sm:rounded-2xl p-5 animate-fade-up max-h-[92vh] overflow-y-auto">
        <div class="flex items-center gap-2 mb-1">
          <h2 class="text-[16px] font-semibold flex-1">批量导入网址</h2>
          <button class="btn btn-sm btn-ghost !px-2" :disabled="busy" aria-label="关闭" @click="open = false">✕</button>
        </div>
        <p class="text-[12.5px] text-ink2 leading-relaxed">粘贴网址或浏览器书签内容，每行一条。名称留空时会自动抓取标题，图标走本地缓存。</p>

        <textarea
          v-model="text"
          rows="6"
          class="field !h-auto min-h-[132px] resize-y py-2 mt-3"
          placeholder="https://github.com&#10;https://news.ycombinator.com&#10;https://www.figma.com"
          :disabled="busy"
        />

        <div class="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
          <label class="text-[12.5px] text-ink2">导入到</label>
          <select v-model="target" class="field !h-9" :disabled="busy">
            <option value="__auto__">自动分类</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            <option value="__new__">新建「导入」分组</option>
          </select>
        </div>

        <p v-if="msg" class="mt-3 text-[12px]" :class="msg.startsWith('已导入') ? 'text-success' : 'text-danger'">{{ msg }}</p>
        <p v-else-if="busy" class="mt-3 text-[12px] text-ink2">正在抓取 {{ done }}/{{ total }}</p>

        <div class="mt-4 flex items-center justify-end gap-2">
          <button class="btn btn-sm" :disabled="busy" @click="open = false">取消</button>
          <button class="btn btn-sm btn-primary min-w-[88px]" :disabled="busy || !text.trim()" @click="run">
            {{ busy ? '导入中…' : '开始导入' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
