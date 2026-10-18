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

interface CommentItem {
  text: string
  liked: number
  song: string
}

interface Cache {
  items: CommentItem[]
  at: number
}

const TTL = 30 * 60 * 1000
const FAIL_TTL = 5 * 60 * 1000
const BAD = /https?:\/\/|www\.|微信|公众号|QQ群|加群|代购|兼职|博彩/i

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

async function fetchSong(id: string, name: string, timeout = 3500): Promise<CommentItem[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(`https://music.163.com/api/v1/resource/comments/R_SO_4_${id}?limit=30`, {
      signal: ctrl.signal,
      headers: {
        Referer: 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'application/json'
      }
    })
    if (!res.ok) return []
    const data: any = await res.json()
    const list = Array.isArray(data?.hotComments) ? data.hotComments : []
    const out: CommentItem[] = []
    for (const item of list) {
      const text = clean(item?.content)
      if (!acceptable(text)) continue
      out.push({ text, liked: Number(item?.likedCount) || 0, song: name })
    }
    return out
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

function pickSongs(): typeof SONGS {
  const pool = [...SONGS]
  const picked: typeof SONGS = []
  while (pool.length && picked.length < 3) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!)
  }
  return picked
}

async function refresh(): Promise<Cache> {
  const batches = await Promise.all(pickSongs().map((song) => fetchSong(song.id, song.name)))
  const seen = new Set<string>()
  const items: CommentItem[] = []
  for (const item of batches.flat()) {
    if (seen.has(item.text)) continue
    seen.add(item.text)
    items.push(item)
  }
  cache = { items, at: Date.now() }
  return cache
}

/** 首页网易云热评：30 分钟缓存，接口失败时返回空由前端回退到本地文案。 */
export async function getNetEaseComment(): Promise<CommentItem | null> {
  if (cache) {
    const ttl = cache.items.length ? TTL : FAIL_TTL
    if (Date.now() - cache.at < ttl) {
      return cache.items.length ? cache.items[Math.floor(Math.random() * cache.items.length)]! : null
    }
  }
  if (!inflight) {
    inflight = refresh().finally(() => { inflight = null })
  }
  const next = await inflight
  if (next.items.length) return next.items[Math.floor(Math.random() * next.items.length)]!
  return cache?.items.length ? cache.items[0]! : null
}
