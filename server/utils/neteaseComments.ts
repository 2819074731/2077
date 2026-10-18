const SONGS = [
  { id: '186016', name: '晴天' },
  { id: '347230', name: '海阔天空' },
  { id: '28815250', name: '平凡之路' },
  { id: '1330348068', name: '起风了' },
  { id: '569213220', name: '像我这样的人' },
  { id: '1824020871', name: '这世界那么多人' },
  { id: '1842025914', name: '孤勇者' },
  { id: '1901371647', name: '人世间' }
]

export type CommentSource = 'hk0' | 'suyanw' | 'netease' | 'fallback'

interface CommentItem {
  text: string
  liked: number
  song: string
  source: CommentSource
}

interface Cache {
  items: CommentItem[]
  at: number
}

const TTL = 15 * 60 * 1000
const FAIL_TTL = 3 * 60 * 1000
const BAD = /https?:\/\/|www\.|微信|公众号|QQ群|加群|代购|兼职|博彩/i
const PREFIX = /^(?:热评|网易云热评|网易云音乐热评)[:：]\s*/i
const SUFFIX = /\s*[—\-–]{1,3}\s*网易云音乐热评.*$/i

let cache: Cache | null = null
let inflight: Promise<Cache> | null = null

function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function acceptable(text: string): boolean {
  if (text.length < 8 || text.length > 56) return false
  if (BAD.test(text)) return false
  return !/[<>]/.test(text)
}

async function fetchJson(url: string, timeout = 3000): Promise<any | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json,text/plain,*/*',
        Referer: 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    })
    if (!res.ok) return null
    const text = (await res.text()).slice(0, 8000)
    try { return JSON.parse(text) } catch { return text }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 主源：api.hk0.cc 网易云热门评论（每日采集，返回单条 JSON）。 */
async function fetchHk0(): Promise<CommentItem[]> {
  const data: any = await fetchJson('https://api.hk0.cc/api/163news', 3000)
  const text = clean(data?.result?.content)
  if (!acceptable(text)) return []
  return [{ text, liked: 0, song: clean(data?.result?.source), source: 'hk0' }]
}

/** 备源：suyanw 纯文本热评。 */
async function fetchSuyanw(): Promise<CommentItem[]> {
  const data = await fetchJson('https://api.suyanw.cn/api/wyyrp/', 3000)
  const raw = typeof data === 'string' ? data : ''
  const text = clean(raw)
    .replace(PREFIX, '')
    .replace(SUFFIX, '')
    .replace(/^[「“"']|[」”"']$/g, '')
    .trim()
  if (!acceptable(text)) return []
  return [{ text, liked: 0, song: '', source: 'suyanw' }]
}

/** 备源：网易云官方热评接口（多首歌随机，抓取失败自动忽略）。 */
async function fetchSong(id: string, name: string, timeout = 3200): Promise<CommentItem[]> {
  const data: any = await fetchJson(`https://music.163.com/api/v1/resource/comments/R_SO_4_${id}?limit=30`, timeout)
  const list = Array.isArray(data?.hotComments) ? data.hotComments : []
  const out: CommentItem[] = []
  for (const item of list) {
    const text = clean(item?.content)
    if (!acceptable(text)) continue
    out.push({ text, liked: Number(item?.likedCount) || 0, song: name, source: 'netease' })
  }
  return out
}

function pickSongs(count = 2): typeof SONGS {
  const pool = [...SONGS]
  const picked: typeof SONGS = []
  while (pool.length && picked.length < count) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!)
  }
  return picked
}

function dedupe(groups: CommentItem[][]): CommentItem[] {
  const seen = new Set<string>()
  const out: CommentItem[] = []
  for (const item of groups.flat()) {
    if (!item.text || seen.has(item.text)) continue
    seen.add(item.text)
    out.push(item)
  }
  return out
}

async function refresh(): Promise<Cache> {
  // 主源并发多取几条，避免「换一句」频繁打外部接口。
  let items = dedupe(await Promise.all([fetchHk0(), fetchHk0(), fetchHk0(), fetchHk0()]))
  if (!items.length) items = dedupe(await Promise.all([fetchSuyanw(), fetchSuyanw()]))
  if (!items.length) items = dedupe(await Promise.all(pickSongs(2).map((song) => fetchSong(song.id, song.name))))
  cache = { items, at: Date.now() }
  return cache
}

async function ensureCache(): Promise<Cache> {
  if (cache) {
    const ttl = cache.items.length ? TTL : FAIL_TTL
    if (Date.now() - cache.at < ttl) return cache
  }
  if (!inflight) {
    inflight = refresh().finally(() => { inflight = null })
  }
  return await inflight
}

/** 首页网易云热评：多源聚合 + 15 分钟缓存，接口失败时返回空由前端回退到本地文案。 */
export async function getNetEaseComment(exclude = ''): Promise<CommentItem | null> {
  const next = await ensureCache()
  if (!next.items.length) return cache?.items[0] || null
  const skip = clean(exclude)
  const pool = skip ? next.items.filter((item) => item.text !== skip) : next.items
  const list = pool.length ? pool : next.items
  return list[Math.floor(Math.random() * list.length)]!
}
