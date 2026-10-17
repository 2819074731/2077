import { DEFAULT_GROUPS, DEFAULT_ENGINE, ENGINES, INLINE_GROUP_COUNT, urlKey, type NavGroup, type Engine } from '~/data/nav'
const uid = () => 'x' + Math.random().toString(36).slice(2, 10)
const LS_GROUPS = 'my2077.groups'
const LS_FREQ = 'my2077.freq'
const LS_FREQ_AT = 'my2077.freq.at'
const LS_FREQ_META = 'my2077.freq.meta'
const LS_ENGINE = 'my2077.engine'
const LS_CUSTOM_ENGINE = 'my2077.engine.custom'

export type FreqMap = Record<string, number>
export type FreqAtMap = Record<string, number>
export type FreqMeta = { pin: string[]; hide: string[] }

function readJson<T>(key: string, fallback: T): T {
  if (!import.meta.client) return fallback
  try {
    const raw = localStorage.getItem(key)
    const value = raw ? JSON.parse(raw) : null
    return value && typeof value === 'object' ? value as T : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (!import.meta.client) return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function readFreq(): FreqMap {
  return readJson<FreqMap>(LS_FREQ, {})
}

function writeFreq(f: FreqMap) {
  writeJson(LS_FREQ, f)
}

function mergeFreq(a: FreqMap, b: FreqMap): FreqMap {
  const out: FreqMap = { ...a }
  for (const k of Object.keys(b)) out[k] = (out[k] || 0) + b[k]
  return out
}

function readFreqAt(): FreqAtMap {
  const raw = readJson<FreqAtMap>(LS_FREQ_AT, {})
  const out: FreqAtMap = {}
  for (const [url, value] of Object.entries(raw)) {
    const t = Number(value)
    if (url && Number.isFinite(t) && t > 0) out[url] = t
  }
  return out
}

function writeFreqAt(value: FreqAtMap) {
  writeJson(LS_FREQ_AT, value)
}

function mergeFreqAt(a: FreqAtMap, b: FreqAtMap): FreqAtMap {
  const out: FreqAtMap = { ...a }
  for (const [url, value] of Object.entries(b)) {
    const t = Number(value)
    if (url && Number.isFinite(t) && t > (out[url] || 0)) out[url] = t
  }
  return out
}

function cleanFreqKeys(input: unknown): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(input) ? input : []) {
    const key = urlKey(String(raw || ''))
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

function readFreqMeta(): FreqMeta {
  const raw = readJson<Partial<FreqMeta>>(LS_FREQ_META, {})
  return { pin: cleanFreqKeys(raw.pin), hide: cleanFreqKeys(raw.hide) }
}

function writeFreqMeta(value: FreqMeta) {
  writeJson(LS_FREQ_META, value)
}

function mergeFreqMeta(a: FreqMeta, b: FreqMeta): FreqMeta {
  const pin = cleanFreqKeys([...a.pin, ...b.pin])
  const pinned = new Set(pin)
  const hide = cleanFreqKeys([...a.hide, ...b.hide]).filter(key => !pinned.has(key))
  return { pin, hide }
}

export function useNav() {
  const groups = useState<NavGroup[]>('nav-groups', () => JSON.parse(JSON.stringify(DEFAULT_GROUPS)))
  const diy = useState<boolean>('nav-diy', () => false)
  const syncMsg = useState<string>('nav-sync-msg', () => '')
  const freq = useState<FreqMap>('nav-freq', () => ({}))
  const freqAt = useState<FreqAtMap>('nav-freq-at', () => ({}))
  const freqMeta = useState<FreqMeta>('nav-freq-meta', () => ({ pin: [], hide: [] }))
  const recommended = useState<{ name: string; url: string; icon?: string }[]>('nav-recommended', () => [])
  const siteConfig = useState<any>('nav-site-config', () => null)
  /** 首页当前分类：null = 全部；否则只展示该分组。 */
  const activeCat = useState<string | null>('nav-active-cat', () => null)
  const engineId = useState<string>('nav-engine', () => DEFAULT_ENGINE)
  const customEngine = useState<Engine | null>('nav-engine-custom', () => null)
  let syncTimer: any = null

  const scheduleSync = () => {
    if (!import.meta.client) return
    localStorage.setItem(LS_GROUPS, JSON.stringify(groups.value))
    const { user } = useAuth()
    if (!user.value) return
    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => pushToCloud(), 900)
  }

  function applySite(d: any, opts: { groups?: boolean } = {}) {
    if (!d || typeof d !== 'object') return
    siteConfig.value = d
    if (opts.groups && Array.isArray(d.groups) && d.groups.length) {
      groups.value = d.groups.map((g: any, gi: number) => ({
        id: 's' + gi,
        name: g.name,
        recommended: !!g.recommended,
        links: (g.links || []).map((l: any, li: number) => ({ id: 's' + gi + '_' + li, name: l.name, url: l.url, icon: l.icon }))
      }))
    }
    if (Array.isArray(d.recommended)) {
      recommended.value = d.recommended.map((l: any) => ({ name: l.name, url: l.url, icon: l.icon }))
    }
  }

  const loadLocal = async () => {
    if (!import.meta.client) return
    let hasLocal = false
    try {
      const raw = localStorage.getItem(LS_GROUPS)
      if (raw) {
        const g = JSON.parse(raw)
        if (Array.isArray(g) && g.length) { groups.value = g; hasLocal = true }
      }
    } catch {}
    diy.value = localStorage.getItem('my2077.diy') === '1'
    freq.value = readFreq()
    freqAt.value = readFreqAt()
    freqMeta.value = readFreqMeta()
    const savedEngine = localStorage.getItem(LS_ENGINE)
    if (savedEngine) engineId.value = savedEngine
    try {
      const ce = localStorage.getItem(LS_CUSTOM_ENGINE)
      if (ce) customEngine.value = JSON.parse(ce)
    } catch {}
    try {
      let d: any = siteConfig.value
      if (!d) {
        d = await $fetch('/api/site')
        siteConfig.value = d
      }
      applySite(d, { groups: !hasLocal })
    } catch {}
  }

  /** 记录一次点击，用于「常用」排序；登录后自动同步到云端。 */
  function recordClick(url: string, name = '') {
    if (!import.meta.client || !url) return
    const key = url.trim()
    if (!key) return
    freq.value = { ...freq.value, [key]: (freq.value[key] || 0) + 1 }
    freqAt.value = { ...freqAt.value, [key]: Date.now() }
    writeFreq(freq.value)
    writeFreqAt(freqAt.value)
    const { user } = useAuth()
    if (user.value) {
      clearTimeout(syncTimer)
      syncTimer = setTimeout(() => pushToCloud(), 1500)
    }
    // 匿名统计：不阻塞跳转，失败静默
    try { $fetch('/api/click', { method: 'POST', body: { url: key, name } }).catch(() => {}) } catch {}
  }

  /** 站长推荐 URL 池（用于分类内置顶排序，不单独成区块）。 */
  function recommendList() {
    return recommended.value.map(r => ({ name: r.name, url: r.url, icon: r.icon }))
  }

  /** 该链接是否被站长推荐。 */
  function isFeatured(url: string): boolean {
    const k = urlKey(url)
    return !!k && recommended.value.some(r => urlKey(r.url) === k)
  }

  /** 分类内排序：推荐链接置顶，其余保持原有顺序（稳定）。 */
  function orderLinks<T extends { url: string }>(links: T[]): T[] {
    const pool = new Set(recommended.value.map(r => urlKey(r.url)).filter(Boolean))
    if (!pool.size) return links
    const featured: T[] = []
    const rest: T[] = []
    for (const l of links) (pool.has(urlKey(l.url)) ? featured : rest).push(l)
    return [...featured, ...rest]
  }

  function persistFreqMeta(next: FreqMeta) {
    freqMeta.value = next
    writeFreqMeta(next)
    scheduleSync()
  }

  function togglePin(url: string) {
    const key = urlKey(url)
    if (!key) return
    const pinned = freqMeta.value.pin.includes(key)
    const pin = pinned ? freqMeta.value.pin.filter(k => k !== key) : [key, ...freqMeta.value.pin]
    const hide = freqMeta.value.hide.filter(k => k !== key)
    persistFreqMeta({ pin, hide })
  }

  function hideFreq(url: string) {
    const key = urlKey(url)
    if (!key) return
    persistFreqMeta({
      pin: freqMeta.value.pin.filter(k => k !== key),
      hide: [key, ...freqMeta.value.hide.filter(k => k !== key)]
    })
  }

  function unhideFreq(url: string) {
    const key = urlKey(url)
    if (!key) return
    persistFreqMeta({ pin: freqMeta.value.pin, hide: freqMeta.value.hide.filter(k => k !== key) })
  }

  function isFreqPinned(url: string) {
    const key = urlKey(url)
    return !!key && freqMeta.value.pin.includes(key)
  }

  function isFreqHidden(url: string) {
    const key = urlKey(url)
    return !!key && freqMeta.value.hide.includes(key)
  }

  /**
   * 常用候选：按「点击次数 × 时间衰减」排序，半衰期 14 天。
   * 置顶项优先；隐藏项只在管理列表中出现。
   */
  function frequentCandidates(limit = 60) {
    const now = Date.now()
    const stats = new Map<string, { count: number; last: number }>()
    for (const [url, value] of Object.entries(freq.value)) {
      const key = urlKey(url)
      const count = Number(value)
      if (!key || !Number.isFinite(count) || count <= 0) continue
      const prev = stats.get(key)
      stats.set(key, {
        count: (prev?.count || 0) + count,
        last: Math.max(prev?.last || 0, Number(freqAt.value[url]) || 0)
      })
    }
    if (!stats.size) return []

    const pinOrder = new Map(freqMeta.value.pin.map((key, index) => [key, index]))
    const hidden = new Set(freqMeta.value.hide)
    const seen = new Set<string>()
    const list: {
      key: string
      name: string
      url: string
      icon?: string
      count: number
      last: number
      score: number
      pinned: boolean
      hidden: boolean
    }[] = []

    for (const group of groups.value) {
      for (const link of group.links) {
        const key = urlKey(link.url)
        if (!key || seen.has(key)) continue
        const stat = stats.get(key)
        if (!stat || stat.count <= 0) continue
        seen.add(key)
        const decay = stat.last ? Math.pow(0.5, Math.max(0, now - stat.last) / 86400000 / 14) : 0.6
        list.push({
          key,
          name: link.name,
          url: link.url,
          icon: link.icon,
          count: stat.count,
          last: stat.last,
          score: stat.count * decay,
          pinned: pinOrder.has(key),
          hidden: hidden.has(key)
        })
      }
    }

    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (a.pinned && b.pinned) return pinOrder.get(a.key)! - pinOrder.get(b.key)!
      if (b.score !== a.score) return b.score - a.score
      return b.last - a.last
    }).slice(0, limit)
  }

  /** 首页「常用」：置顶优先，默认隐藏项不展示。 */
  function frequentList(limit = 12) {
    return frequentCandidates(80)
      .filter(item => !item.hidden || item.pinned)
      .slice(0, limit)
  }

  /** 常用管理列表：包含隐藏项，便于恢复。 */
  function frequentManageList(limit = 60) {
    return frequentCandidates(limit)
  }

  /** 首页当前展示的分组：选中分类时仅该组，否则内联前 N 组。 */
  function visibleGroups() {
    if (activeCat.value) {
      const g = groups.value.find(x => x.id === activeCat.value || x.name === activeCat.value)
      return g ? [g] : []
    }
    return groups.value.slice(0, INLINE_GROUP_COUNT)
  }

  function selectCat(id: string | null) {
    activeCat.value = id
    if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** 所有可用搜索引擎：内置 + 用户自定义。 */
  function allEngines(): Engine[] {
    return customEngine.value ? [...ENGINES, customEngine.value] : ENGINES
  }

  /** 当前搜索引擎对象。 */
  function currentEngine(): Engine {
    return allEngines().find(e => e.id === engineId.value) || ENGINES[0]
  }

  /** 设置默认搜索引擎（内置 id 或自定义对象）。 */
  function setEngine(id: string, custom?: Engine) {
    if (custom) {
      customEngine.value = custom
      engineId.value = custom.id
      if (import.meta.client) {
        localStorage.setItem(LS_CUSTOM_ENGINE, JSON.stringify(custom))
        localStorage.setItem(LS_ENGINE, custom.id)
      }
      return
    }
    engineId.value = id
    if (import.meta.client) localStorage.setItem(LS_ENGINE, id)
  }

  /** 移除自定义搜索引擎。 */
  function clearCustomEngine() {
    if (customEngine.value && engineId.value === customEngine.value.id) engineId.value = DEFAULT_ENGINE
    customEngine.value = null
    if (import.meta.client) {
      localStorage.removeItem(LS_CUSTOM_ENGINE)
      localStorage.setItem(LS_ENGINE, engineId.value)
    }
  }

  async function pushToCloud() {
    const { user } = useAuth()
    if (!user.value) return
    syncMsg.value = '同步中...'
    try {
      await $fetch('/api/config', { method: 'PUT', body: { groups: groups.value, freq: freq.value, freqAt: freqAt.value, freqMeta: freqMeta.value } })
      syncMsg.value = '已同步到云端'
    } catch (e: any) {
      syncMsg.value = '同步失败：' + (e?.data?.message || e.message)
    }
    setTimeout(() => (syncMsg.value = ''), 2200)
  }

  async function pullFromCloud() {
    try {
      const d: any = await $fetch('/api/config')
      if (d?.groups?.length) groups.value = d.groups
      if (d?.freq && typeof d.freq === 'object') {
        freq.value = mergeFreq(freq.value, d.freq)
        writeFreq(freq.value)
      }
      if (d?.freqAt && typeof d.freqAt === 'object') {
        freqAt.value = mergeFreqAt(freqAt.value, d.freqAt)
        writeFreqAt(freqAt.value)
      }
      if (d?.freqMeta && typeof d.freqMeta === 'object') {
        freqMeta.value = mergeFreqMeta(freqMeta.value, d.freqMeta)
        writeFreqMeta(freqMeta.value)
      }
    } catch {}
  }

  function resetFreq() {
    freq.value = {}
    freqAt.value = {}
    freqMeta.value = { pin: [], hide: [] }
    if (import.meta.client) {
      localStorage.removeItem(LS_FREQ)
      localStorage.removeItem(LS_FREQ_AT)
      localStorage.removeItem(LS_FREQ_META)
    }
    const { user } = useAuth()
    if (user.value) pushToCloud()
  }

  return {
    groups,
    diy,
    syncMsg,
    freq,
    recommended,
    activeCat,
    engineId,
    customEngine,
    applySite,
    loadLocal,
    pullFromCloud,
    pushToCloud,
    recordClick,
    recommendList,
    isFeatured,
    orderLinks,
    frequentList,
    frequentManageList,
    togglePin,
    hideFreq,
    unhideFreq,
    isFreqPinned,
    isFreqHidden,
    visibleGroups,
    selectCat,
    allEngines,
    currentEngine,
    setEngine,
    clearCustomEngine,
    resetFreq,
    toggleDiy() {
      diy.value = !diy.value
      if (import.meta.client) localStorage.setItem('my2077.diy', diy.value ? '1' : '0')
    },
    addGroup() { groups.value.push({ id: uid(), name: '新分组', links: [] }); scheduleSync() },
    removeGroup(gid: string) { groups.value = groups.value.filter(g => g.id !== gid); scheduleSync() },
    renameGroup(gid: string, name: string) {
      const g = groups.value.find(x => x.id === gid); if (g) { g.name = name; scheduleSync() }
    },
    addLink(gid: string, link: { name: string; url: string; icon?: string }) {
      const g = groups.value.find(x => x.id === gid)
      if (g && link.name && link.url) { g.links.push({ id: uid(), name: link.name, url: link.url, icon: link.icon }); scheduleSync() }
    },
    updateLink(gid: string, lid: string, patch: Partial<NavGroup['links'][number]>) {
      const g = groups.value.find(x => x.id === gid)
      const l = g?.links.find(x => x.id === lid)
      if (l) { Object.assign(l, patch); scheduleSync() }
    },
    removeLink(gid: string, lid: string) {
      const g = groups.value.find(x => x.id === gid)
      if (g) { g.links = g.links.filter(x => x.id !== lid); scheduleSync() }
    },
    moveLink(gid: string, lid: string, dir: number) {
      const g = groups.value.find(x => x.id === gid); if (!g) return
      const i = g.links.findIndex(x => x.id === lid), j = i + dir
      if (i < 0 || j < 0 || j >= g.links.length) return
      const [it] = g.links.splice(i, 1); g.links.splice(j, 0, it); scheduleSync()
    },
    resetAll() { groups.value = JSON.parse(JSON.stringify(DEFAULT_GROUPS)); scheduleSync() }
  }
}
