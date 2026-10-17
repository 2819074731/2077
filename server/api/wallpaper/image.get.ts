const TTL = 1000 * 60 * 60 * 24 * 3
const MAX = 40
const cache = new Map<string, { body: Buffer; type: string; at: number }>()

/** 仅允许代理必应壁纸域名，避免 SSRF。 */
function normalize(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s)
    if (u.hostname !== 'www.bing.com' && u.hostname !== 'bing.com') return ''
    if (!/^\/th\?/.test(u.pathname + '?')) return ''
    return u.toString()
  } catch {
    return ''
  }
}

async function fetchImage(url: string, timeout = 8000): Promise<{ body: Buffer; type: string } | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 2077Bot/1.0)', Accept: 'image/*,*/*;q=0.5' }
    })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').split(';')[0].trim()
    if (type && !type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100 || buf.length > 12 * 1024 * 1024) return null
    return { body: buf, type: type || 'image/jpeg' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const url = normalize(String(q.url || ''))
  if (!url) {
    setResponseStatus(event, 404)
    return ''
  }

  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < TTL) {
    setHeader(event, 'Content-Type', hit.type)
    setHeader(event, 'Cache-Control', 'public, max-age=259200, immutable')
    setHeader(event, 'X-Wallpaper-Cache', 'HIT')
    return hit.body
  }

  const img = await fetchImage(url)
  if (!img) {
    setResponseStatus(event, 404)
    return ''
  }
  if (cache.size >= MAX) cache.delete(cache.keys().next().value as string)
  cache.set(url, { ...img, at: Date.now() })
  setHeader(event, 'Content-Type', img.type)
  setHeader(event, 'Cache-Control', 'public, max-age=259200, immutable')
  setHeader(event, 'X-Wallpaper-Cache', 'MISS')
  return img.body
})
