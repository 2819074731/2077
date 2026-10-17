<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CloudLink } from '~/composables/useAuth'
import { iconFor, hostOf } from '~/data/nav'
import { parseBookmarksHtml } from '#shared/bookmarks'
const { user, refresh, logout, saveCloudLinks, updateProfile, changePassword, revokeOtherSessions } = useAuth()
const route = useRoute()
const router = useRouter()
const { pushToCloud, pullFromCloud, resetAll, syncMsg } = useNav()

const links = ref<CloudLink[]>([])
const loaded = ref(false)
const saving = ref(false)
const invalidIdx = ref<number[]>([])
const msg = ref('')
const msgKind = ref<'ok' | 'err' | ''>('')
const syncBusy = ref<'' | 'push' | 'pull'>('')
const syncLocal = ref('')
const snapshot = ref('')
let msgTimer: any = null
let syncTimer: any = null

const nicknameDraft = ref('')
const usernameDraft = ref('')
const qqDraft = ref('')
const avatarDraft = ref('')

type TabKey = 'profile' | 'links' | 'security' | 'sync'
const tab = ref<TabKey>('profile')
const tabs: { key: TabKey; label: string }[] = [
  { key: 'profile', label: '账号资料' },
  { key: 'links', label: '云端网址' },
  { key: 'security', label: '账号安全' },
  { key: 'sync', label: '导航同步' }
]

function setTab(key: TabKey) {
  tab.value = key
  const query: Record<string, any> = { ...route.query }
  if (key === 'profile') delete query.tab
  else query.tab = key
  router.replace({ query })
}

watch(() => route.query.tab, (v) => {
  const key = String(v || '') as TabKey
  if (tabs.some(t => t.key === key)) tab.value = key
})
const avatarBusy = ref(false)
const profileSaving = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const pwCurrent = ref('')
const pwNext = ref('')
const pwConfirm = ref('')
const pwSaving = ref(false)
const revoking = ref(false)
const bookmarkInput = ref<HTMLInputElement | null>(null)
const pasteOpen = ref(false)
const pasteText = ref('')
const importBusy = ref(false)
const importDone = ref(0)
const importTotal = ref(0)
const fetchingUrl = ref('')

useSeoMeta({ title: '我的设置 · 2077 导航', robots: 'noindex' })

function normalizeUrl(raw: string) {
  const v = (raw || '').trim()
  if (!v) return ''
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v) ? v : `https://${v}`
}

function isHttpUrl(raw: string) {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function serialize(list: CloudLink[]) {
  return list
    .map(l => ({ name: (l.name || '').trim(), url: normalizeUrl(l.url || ''), icon: l.icon || '', public: l.public !== false }))
    .filter(l => l.name || l.url)
}

function normalizeKey(raw: string) {
  try {
    const u = new URL(normalizeUrl(raw))
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function cleanTitle(title: string) {
  return String(title || '').split(/[-_|·—]/)[0].trim().slice(0, 60)
}

const duplicateIdx = computed(() => {
  const groups = new Map<string, number[]>()
  links.value.forEach((l, i) => {
    const k = normalizeKey(l.url || '')
    if (!k) return
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(i)
  })
  const set = new Set<number>()
  for (const arr of groups.values()) if (arr.length > 1) arr.forEach(i => set.add(i))
  return set
})
const publicCount = computed(() => links.value.filter(l => l.url && l.public !== false).length)
const dirty = computed(() => loaded.value && JSON.stringify(serialize(links.value)) !== snapshot.value)
const syncText = computed(() => syncMsg.value || syncLocal.value)
const syncFailed = computed(() => syncText.value.includes('失败'))
const nicknameInvalid = computed(() => {
  const v = nicknameDraft.value.trim()
  return !v || v.length > 60
})
const usernameInvalid = computed(() => {
  const v = usernameDraft.value.trim().toLowerCase()
  return !!v && !/^[a-z0-9_-]{3,60}$/.test(v)
})
const qqInvalid = computed(() => !!qqDraft.value.trim() && !/^[1-9]\d{4,11}$/.test(qqDraft.value.trim()))
const canRemoveAvatar = computed(() => avatarDraft.value.startsWith('data:image/'))
const profileDirty = computed(() => {
  if (!user.value) return false
  return nicknameDraft.value.trim() !== (user.value.nickname || '')
    || usernameDraft.value.trim().toLowerCase() !== (user.value.username || '')
    || qqDraft.value.trim() !== (user.value.qq || '')
    || avatarDraft.value !== (user.value.avatar || '')
})
const pwMismatch = computed(() => !!pwConfirm.value && pwNext.value !== pwConfirm.value)
const pwReady = computed(() => !!pwCurrent.value && pwNext.value.length >= 6 && pwNext.value === pwConfirm.value)


function flash(text: string, kind: 'ok' | 'err' = 'ok') {
  msg.value = text
  msgKind.value = kind
  clearTimeout(msgTimer)
  msgTimer = setTimeout(() => {
    msg.value = ''
    msgKind.value = ''
  }, 2600)
}

function syncNote(text: string) {
  syncLocal.value = text
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => (syncLocal.value = ''), 2400)
}

onMounted(async () => {
  await refresh()
  if (!user.value) {
    await navigateTo('/login?redirect=/settings')
    return
  }
  const wantedTab = String(route.query.tab || '') as TabKey
  if (tabs.some(t => t.key === wantedTab)) tab.value = wantedTab
  nicknameDraft.value = user.value.nickname || ''
  usernameDraft.value = user.value.username || ''
  qqDraft.value = user.value.qq || ''
  avatarDraft.value = user.value.avatar || ''
  links.value = (user.value.links || []).map(l => ({ ...l }))
  snapshot.value = JSON.stringify(serialize(links.value))
  loaded.value = true
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  clearTimeout(msgTimer)
  clearTimeout(syncTimer)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  return window.confirm('有未保存的更改，确定离开？')
})

function addRow() {
  if (links.value.length >= 50) {
    flash('最多保存 50 条网址', 'err')
    return
  }
  links.value.push({ name: '', url: '', public: true })
}

function removeRow(i: number) {
  links.value.splice(i, 1)
  invalidIdx.value = []
}

function moveRow(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= links.value.length) return
  const [row] = links.value.splice(i, 1)
  links.value.splice(j, 0, row)
  invalidIdx.value = []
}

function clearInvalid(i: number) {
  if (!invalidIdx.value.includes(i)) return
  invalidIdx.value = invalidIdx.value.filter(x => x !== i)
}

async function fetchMetaFor(l: CloudLink) {
  if (fetchingUrl.value || !isHttpUrl(normalizeUrl(l.url || ''))) return false
  fetchingUrl.value = l.url
  try {
    const d: any = await $fetch('/api/meta', { method: 'POST', body: { url: l.url } })
    const m = d.meta || {}
    if (!(l.name || '').trim()) l.name = cleanTitle(m.title) || m.host || hostOf(l.url)
    l.icon = m.host ? `/api/icon?url=${encodeURIComponent(m.host)}` : iconFor(l.url)
    return true
  } catch {
    if (!(l.name || '').trim()) l.name = hostOf(normalizeUrl(l.url || ''))
    if (!l.icon) l.icon = iconFor(l.url)
    return false
  } finally {
    fetchingUrl.value = ''
  }
}

function onUrlBlur(l: CloudLink) {
  if (!l.icon) l.icon = iconFor(l.url)
  if (!(l.name || '').trim()) fetchMetaFor(l)
}

async function fillNames(rows: CloudLink[]) {
  if (!rows.length) return
  importBusy.value = true
  importTotal.value = rows.length
  importDone.value = 0
  const queue = [...rows]
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const l = queue.shift()!
      await fetchMetaFor(l)
      importDone.value++
    }
  })
  await Promise.all(workers)
  importBusy.value = false
}

async function appendLinks(items: Array<{ name?: string; url: string }>, fetchNames: boolean) {
  const room = 50 - links.value.length
  if (room <= 0) {
    flash('最多保存 50 条网址', 'err')
    return
  }
  const seen = new Set(links.value.map(l => normalizeKey(l.url || '')).filter(Boolean))
  const fresh: CloudLink[] = []
  for (const it of items) {
    const url = normalizeUrl(it.url)
    if (!isHttpUrl(url)) continue
    const k = normalizeKey(url)
    if (!k || seen.has(k)) continue
    seen.add(k)
    fresh.push({
      name: (it.name || '').trim(),
      url,
      icon: iconFor(url),
      public: true
    })
    if (fresh.length >= room) break
  }
  if (!fresh.length) {
    flash('没有可导入的新网址')
    return
  }
  links.value.push(...fresh)
  const truncated = fresh.length < items.length
  flash(`已导入 ${fresh.length} 条${truncated ? '（已去重或超出 50 条上限）' : ''}`)
  if (fetchNames) await fillNames(fresh.filter(l => !(l.name || '').trim()))
}

async function importBookmarks(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const folders = parseBookmarksHtml(await file.text())
    const items = folders.flatMap(f => f.links)
    if (!items.length) {
      flash('未识别到书签，请选择浏览器导出的 HTML 文件', 'err')
      return
    }
    await appendLinks(items, false)
  } catch {
    flash('书签解析失败', 'err')
  }
}

function openPaste() {
  pasteText.value = ''
  pasteOpen.value = true
}

async function importPaste() {
  if (importBusy.value) return
  const found = new Set<string>()
  const re = /https?:\/\/[^\s"'<>]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(pasteText.value))) found.add(m[0])
  for (const line of pasteText.value.split(/\r?\n/)) {
    const t = line.trim()
    if (/^[\w.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(t)) found.add('https://' + t)
  }
  const items = Array.from(found).slice(0, 50).map(url => ({ url }))
  if (!items.length) {
    flash('没有识别到网址', 'err')
    return
  }
  await appendLinks(items, true)
  if (!importBusy.value) {
    pasteOpen.value = false
    pasteText.value = ''
  }
}

async function save() {
  if (saving.value) return
  invalidIdx.value = []
  const bad: number[] = []
  const clean: CloudLink[] = []
  links.value.forEach((l, i) => {
    const name = (l.name || '').trim()
    const url = normalizeUrl(l.url || '')
    if (!name && !url) return
    if (!name || !url || !isHttpUrl(url)) {
      bad.push(i)
      return
    }
    clean.push({ name, url, icon: l.icon, sort: clean.length, public: l.public !== false })
  })
  if (bad.length) {
    invalidIdx.value = bad
    flash(`有 ${bad.length} 行名称为空或网址无效`, 'err')
    return
  }
  if (duplicateIdx.value.size) {
    flash(`有 ${duplicateIdx.value.size} 条重复网址，请先合并或删除`, 'err')
    return
  }
  for (const l of clean) {
    if (!l.icon) l.icon = iconFor(l.url)
  }
  saving.value = true
  try {
    const saved = await saveCloudLinks(clean)
    links.value = (saved || clean).map(l => ({ ...l }))
    snapshot.value = JSON.stringify(serialize(links.value))
    flash(links.value.length ? '已保存' : '已清空云端网址')
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '保存失败', 'err')
  } finally {
    saving.value = false
  }
}

async function doPush() {
  if (syncBusy.value) return
  syncBusy.value = 'push'
  try {
    await pushToCloud()
  } finally {
    syncBusy.value = ''
  }
}

async function doPull() {
  if (syncBusy.value) return
  syncBusy.value = 'pull'
  try {
    await pullFromCloud()
    syncNote('已从云端拉取')
  } catch {
    syncNote('拉取失败，请稍后重试')
  } finally {
    syncBusy.value = ''
  }
}

function doReset() {
  if (!window.confirm('恢复默认导航会覆盖当前本地分组，确定继续？')) return
  resetAll()
  syncNote('已恢复默认导航')
}

async function onLogout() {
  await logout()
  await navigateTo('/')
}

function pickAvatar() {
  if (avatarBusy.value) return
  avatarInput.value?.click()
}

function compressImage(file: File, max: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas unavailable'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode failed'))
    }
    img.src = url
  })
}

async function onAvatarFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!/^image\/(?:png|jpeg|webp)$/.test(file.type)) {
    flash('仅支持 PNG / JPG / WebP', 'err')
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    flash('图片不能超过 8MB', 'err')
    return
  }
  avatarBusy.value = true
  try {
    avatarDraft.value = await compressImage(file, 192, 0.85)
  } catch {
    flash('图片处理失败，请换一张试试', 'err')
  } finally {
    avatarBusy.value = false
  }
}

async function saveProfile() {
  if (profileSaving.value || nicknameInvalid.value || usernameInvalid.value || qqInvalid.value) return
  profileSaving.value = true
  try {
    const body: { nickname: string; username: string; qq: string; avatar?: string | null } = {
      nickname: nicknameDraft.value.trim(),
      username: usernameDraft.value.trim().toLowerCase(),
      qq: qqDraft.value.trim()
    }
    if (avatarDraft.value !== (user.value?.avatar || '')) body.avatar = avatarDraft.value || null
    const u = await updateProfile(body)
    nicknameDraft.value = u.nickname
    usernameDraft.value = u.username || ''
    qqDraft.value = u.qq || ''
    avatarDraft.value = u.avatar || ''
    flash('资料已更新')
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.data?.message || '保存失败', 'err')
  } finally {
    profileSaving.value = false
  }
}

async function savePassword() {
  if (pwSaving.value || !pwReady.value) return
  pwSaving.value = true
  try {
    const d: any = await changePassword(pwCurrent.value, pwNext.value)
    pwCurrent.value = ''
    pwNext.value = ''
    pwConfirm.value = ''
    flash(d?.removed ? `密码已更新，已退出 ${d.removed} 个其他设备` : '密码已更新')
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.data?.message || '修改失败', 'err')
  } finally {
    pwSaving.value = false
  }
}

async function revokeOthers() {
  if (revoking.value) return
  if (!window.confirm('将退出除当前浏览器外的所有登录状态，确定继续？')) return
  revoking.value = true
  try {
    const d: any = await revokeOtherSessions()
    flash(d?.removed ? `已退出 ${d.removed} 个其他设备` : '没有其他登录设备')
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.data?.message || '操作失败', 'err')
  } finally {
    revoking.value = false
  }
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-8 sm:py-10 animate-fade-up">
    <header class="flex items-center gap-3.5 mb-6">
      <UserAvatar :src="user?.avatar" :name="user?.nickname" class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl text-lg shadow-soft shrink-0" />
      <div class="min-w-0 flex-1">
        <h1 class="text-lg sm:text-xl font-semibold truncate">{{ user?.nickname || '我的设置' }}</h1>
        <p class="text-[12.5px] sm:text-[13px] text-ink2 truncate">
          <NuxtLink :to="`/u/${user?.id}`" class="hover:text-ink hover:underline">/u/{{ user?.id }}</NuxtLink>
          <span class="mx-1.5 opacity-40">·</span>{{ user?.email }}
        </p>
      </div>
      <button class="btn btn-sm btn-ghost shrink-0" title="退出登录" @click="onLogout">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
        <span class="hidden sm:inline">退出登录</span>
      </button>
    </header>

    <div class="flex items-center gap-1 overflow-x-auto border-b border-line mb-5 -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="设置分类">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="tab === t.key"
        class="relative shrink-0 h-11 px-3.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors"
        :class="tab === t.key ? 'border-ink text-ink' : 'border-transparent text-ink2 hover:text-ink'"
        @click="setTab(t.key)"
      >
        {{ t.label }}
        <span v-if="t.key === 'links'" class="chip ml-1.5 !text-[10px]">{{ links.length }}</span>
      </button>
    </div>

    <section v-if="tab === 'profile'" role="tabpanel" class="card p-4 sm:p-6 max-w-[760px]">
      <div class="flex items-center gap-3.5">
        <UserAvatar :src="avatarDraft" :name="nicknameDraft" class="w-16 h-16 rounded-2xl text-2xl shadow-soft shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-[15px] truncate">{{ nicknameDraft || '未命名' }}</p>
          <p class="text-[12px] text-ink3 truncate">{{ user?.email }}</p>
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <button class="btn btn-sm" :disabled="avatarBusy" @click="pickAvatar">{{ avatarBusy ? '处理中…' : '更换头像' }}</button>
            <button v-if="canRemoveAvatar" class="btn btn-sm btn-ghost" @click="avatarDraft = ''">恢复 QQ 头像</button>
          </div>
          <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onAvatarFile" />
        </div>
      </div>
      <p class="mt-2.5 text-[11.5px] text-ink3 leading-relaxed">支持 PNG / JPG / WebP，自动压缩为 192px 方形头像。未上传自定义头像时，默认使用 QQ 头像。</p>

      <div class="mt-5 grid sm:grid-cols-2 gap-3.5">
        <div>
          <label class="block text-[12.5px] text-ink2 mb-1.5" for="nickname">昵称</label>
          <input id="nickname" v-model="nicknameDraft" class="field" maxlength="60" placeholder="显示名称" autocomplete="nickname" />
        </div>
        <div>
          <label class="block text-[12.5px] text-ink2 mb-1.5" for="qq">QQ 号</label>
          <input id="qq" v-model="qqDraft" class="field" inputmode="numeric" maxlength="12" placeholder="用于生成默认头像" autocomplete="off" />
          <p v-if="qqInvalid" class="mt-1 text-[11.5px] text-danger">请填写 5-12 位 QQ 号</p>
          <p v-else class="mt-1 text-[11.5px] text-ink3">填写后，未设置自定义头像时默认使用 QQ 头像；QQ 仅管理员可见。</p>
        </div>
        <div class="sm:col-span-2">
          <label class="block text-[12.5px] text-ink2 mb-1.5" for="username">用户名</label>
          <input id="username" v-model="usernameDraft" class="field" maxlength="60" placeholder="可选，用于登录" autocapitalize="off" spellcheck="false" autocomplete="username" />
          <p v-if="usernameInvalid" class="mt-1 text-[11.5px] text-danger">用户名需 3-60 位小写字母、数字、下划线或短横线</p>
          <p v-else class="mt-1 text-[11.5px] text-ink3">可用用户名或邮箱登录，留空则仅用邮箱。</p>
        </div>
      </div>
      <button class="btn btn-primary w-full sm:w-auto sm:min-w-[120px] mt-5" :disabled="profileSaving || !profileDirty || nicknameInvalid || usernameInvalid || qqInvalid" @click="saveProfile">{{ profileSaving ? '保存中…' : '保存资料' }}</button>
    </section>

    <section v-if="tab === 'links'" role="tabpanel" class="card p-4 sm:p-6">
      <div class="flex flex-col sm:flex-row sm:items-start gap-3">
        <div class="flex items-start gap-2.5 min-w-0 flex-1">
          <span class="h-4 w-1 mt-1 rounded-full accent-bar shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="font-semibold">我的云端网址</h2>
              <span class="chip">{{ links.length }}</span>
              <span class="text-[11.5px] text-ink3">{{ publicCount }} 条公开 · {{ links.length - publicCount }} 条私密</span>
            </div>
            <p class="text-[12.5px] sm:text-[13px] text-ink2 mt-0.5">公开的网址会展示在你的个人主页，最多保存 50 条。</p>
          </div>
        </div>
        <div class="grid grid-cols-3 sm:flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button class="btn btn-sm btn-ghost w-full sm:w-auto" @click="bookmarkInput?.click()">导入书签</button>
          <button class="btn btn-sm btn-ghost w-full sm:w-auto" @click="openPaste">粘贴导入</button>
          <button class="btn btn-sm w-full sm:w-auto" @click="addRow">+ 添加</button>
          <input ref="bookmarkInput" type="file" accept="text/html,.html,.htm" class="hidden" @change="importBookmarks" />
        </div>
      </div>

      <div v-if="pasteOpen" class="mt-4 rounded-xl border border-line bg-card2 p-3">
        <textarea
          v-model="pasteText"
          rows="4"
          class="field !h-auto min-h-[96px] resize-y py-2"
          placeholder="每行一个网址，例如：&#10;https://github.com&#10;https://news.ycombinator.com"
          :disabled="importBusy"
        />
        <div class="mt-2 flex items-center gap-2 flex-wrap">
          <span class="text-[11.5px] text-ink3 flex-1 min-w-[160px]">{{ importBusy ? `正在抓取 ${importDone}/${importTotal}` : '留空名称会自动抓取标题，重复网址会跳过' }}</span>
          <button class="btn btn-sm btn-ghost" :disabled="importBusy" @click="pasteOpen = false; pasteText = ''">取消</button>
          <button class="btn btn-sm btn-primary" :disabled="importBusy || !pasteText.trim()" @click="importPaste">导入</button>
        </div>
      </div>

      <div v-if="!loaded" class="mt-5 flex flex-col gap-2.5">
        <div v-for="i in 3" :key="i" class="h-[92px] sm:h-[46px] rounded-xl bg-card2 animate-pulse" />
      </div>

      <template v-else>
        <div v-if="!links.length" class="mt-5 flex flex-col items-center gap-3 border border-dashed border-line rounded-xl px-4 py-10 text-center">
          <span class="grid place-items-center w-11 h-11 rounded-2xl bg-card2 text-ink3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1L11 5" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1-1" /></svg>
          </span>
          <div>
            <p class="text-[13.5px] font-medium">还没有云端网址</p>
            <p class="text-[12.5px] text-ink2 mt-0.5">添加常用站点，换设备登录也能同步。</p>
          </div>
          <button class="btn btn-sm btn-primary" @click="addRow">添加第一个网址</button>
        </div>

        <div v-else class="mt-5 flex flex-col gap-2.5">
          <div
            v-for="(l, i) in links"
            :key="i"
            class="rounded-xl border p-3 sm:px-3 sm:py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-2 transition-colors"
            :class="invalidIdx.includes(i) ? 'border-danger bg-card2' : 'border-line bg-card2 sm:border-transparent sm:bg-transparent'"
          >
            <div class="flex items-center gap-2 sm:contents">
              <span class="grid place-items-center w-6 h-6 shrink-0 rounded-lg border border-line bg-card text-[11px] font-semibold text-ink3 sm:hidden">{{ i + 1 }}</span>
              <input
                v-model="l.name"
                class="field sm:!w-40 sm:shrink-0"
                :class="invalidIdx.includes(i) && !(l.name || '').trim() ? '!border-danger' : ''"
                placeholder="名称"
                aria-label="名称"
                maxlength="60"
                autocomplete="off"
                @input="clearInvalid(i)"
              />
            </div>
            <input
              v-model="l.url"
              class="field grow min-w-0"
              :class="[invalidIdx.includes(i) && !isHttpUrl(normalizeUrl(l.url || '')) ? '!border-danger' : '', duplicateIdx.has(i) ? '!border-warning' : '']"
              :title="duplicateIdx.has(i) ? '重复网址' : ''"
              placeholder="https://example.com"
              aria-label="网址"
              inputmode="url"
              autocapitalize="off"
              spellcheck="false"
              maxlength="500"
              autocomplete="off"
              @input="clearInvalid(i)"
              @blur="onUrlBlur(l)"
            />
            <div class="flex items-center justify-between gap-2 sm:justify-end">
              <button
                type="button"
                role="switch"
                :aria-checked="l.public !== false"
                class="inline-flex items-center gap-2 rounded-lg px-1 py-1 -ml-1 text-[12.5px] text-ink2 transition-colors hover:text-ink"
                @click="l.public = l.public === false"
              >
                <span class="relative inline-flex w-[34px] h-5 shrink-0 rounded-full transition-colors" :class="l.public !== false ? 'bg-ink' : 'bg-line2'">
                  <span class="absolute left-[3px] top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition-transform" :class="l.public !== false ? 'translate-x-[14px]' : ''" />
                </span>
                公开
              </button>
              <div class="flex items-center gap-0.5">
                <button class="btn btn-sm btn-ghost text-ink3 !px-0 w-9 sm:w-8" :disabled="i === 0" title="上移" aria-label="上移" @click="moveRow(i, -1)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15 6-6 6 6" /></svg>
                </button>
                <button class="btn btn-sm btn-ghost text-ink3 !px-0 w-9 sm:w-8" :disabled="i === links.length - 1" title="下移" aria-label="下移" @click="moveRow(i, 1)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <button class="btn btn-sm btn-ghost text-ink3 hover:text-danger !px-0 w-9 sm:w-8" title="删除" aria-label="删除" @click="removeRow(i)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 11v5m4-5v5" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="sticky bottom-0 z-10 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-5 flex items-center gap-3 rounded-b-2xl border-t border-line bg-bg px-4 sm:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 backdrop-blur">
          <div class="min-w-0 flex-1">
            <p v-if="importBusy" class="text-[12.5px] text-ink2">正在抓取名称 {{ importDone }}/{{ importTotal }}</p>
            <p v-else-if="duplicateIdx.size" class="text-[12.5px] text-warning">{{ duplicateIdx.size }} 条重复网址，请先处理</p>
            <p v-else-if="dirty" class="text-[12.5px] text-warning">有未保存的更改</p>
            <p v-else class="text-[12px] text-ink3 truncate">{{ links.length }} 条网址 · {{ publicCount }} 条公开</p>
          </div>
          <button class="btn btn-primary min-w-[88px] disabled:opacity-50 disabled:cursor-not-allowed" :disabled="saving || !dirty || duplicateIdx.size > 0 || importBusy" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </template>
    </section>

    <section v-if="tab === 'security'" role="tabpanel" class="card p-4 sm:p-6 max-w-[560px]">
      <div class="flex items-center gap-2.5 mb-2.5">
        <span class="h-4 w-1 rounded-full accent-bar" />
        <h2 class="font-semibold">修改密码</h2>
      </div>
      <p class="text-[12.5px] text-ink2 leading-relaxed">修改密码后，其他设备上的登录会自动失效。</p>
      <div class="mt-4 flex flex-col gap-2.5">
        <input v-model="pwCurrent" type="password" class="field" placeholder="当前密码" autocomplete="current-password" />
        <input v-model="pwNext" type="password" class="field" placeholder="新密码（至少 6 位）" autocomplete="new-password" maxlength="72" />
        <input v-model="pwConfirm" type="password" class="field" placeholder="确认新密码" autocomplete="new-password" maxlength="72" />
        <p v-if="pwMismatch" class="text-[11.5px] text-danger">两次输入的新密码不一致</p>
        <button class="btn btn-sm btn-primary w-full" :disabled="pwSaving || !pwReady" @click="savePassword">{{ pwSaving ? '更新中…' : '更新密码' }}</button>
      </div>
      <div class="mt-5 pt-5 border-t border-line">
        <button class="btn btn-sm btn-ghost w-full" :disabled="revoking" @click="revokeOthers">{{ revoking ? '处理中…' : '退出其他设备' }}</button>
        <p class="mt-2 text-[11.5px] text-ink3 leading-relaxed">清除除当前浏览器外的所有登录状态。</p>
      </div>
    </section>

    <section v-if="tab === 'sync'" role="tabpanel" class="card p-4 sm:p-6 max-w-[560px]">
      <div class="flex items-center gap-2.5 mb-2.5">
        <span class="h-4 w-1 rounded-full accent-bar" />
        <h2 class="font-semibold">导航配置同步</h2>
      </div>
      <p class="text-[12.5px] text-ink2 leading-relaxed">首页「自定义」编辑的分组与链接会与云端双向同步，常用站点按近期点击频率排序，可在首页「常用」区置顶或隐藏。</p>
      <div class="mt-4 flex flex-col gap-2">
        <button class="btn btn-sm btn-primary w-full" :disabled="!!syncBusy" @click="doPush">{{ syncBusy === 'push' ? '推送中…' : '推送到云端' }}</button>
        <div class="grid grid-cols-2 gap-2">
          <button class="btn btn-sm" :disabled="!!syncBusy" @click="doPull">{{ syncBusy === 'pull' ? '拉取中…' : '从云端拉取' }}</button>
          <button class="btn btn-sm btn-ghost" @click="doReset">恢复默认</button>
        </div>
      </div>
      <p class="mt-3 min-h-[18px] text-[12px] leading-snug" :class="syncFailed ? 'text-danger' : 'text-ink3'">{{ syncText }}</p>
      <NuxtLink :to="`/u/${user?.id}`" class="btn btn-sm w-full mt-2">查看个人主页</NuxtLink>
    </section>

    <div
      v-if="msg"
      class="fixed left-1/2 bottom-6 z-50 -translate-x-1/2 rounded-xl border border-line bg-bg px-4 py-2.5 text-[12.5px] shadow-soft"
      :class="msgKind === 'err' ? 'text-danger' : 'text-ink'"
      role="status"
    >{{ msg }}</div>
  </div>
</template>
