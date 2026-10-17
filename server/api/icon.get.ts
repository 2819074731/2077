import { isIP } from 'node:net'

const PRIVATE_V4 = [
  /^10\./, /^127\./, /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./
]

function blocked(host: string): boolean {
  const h = host.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (isIP(h) === 4) return PRIVATE_V4.some((r) => r.test(h))
  if (isIP(h) === 6) return h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')
  return false
}

function normalize(input: string): string {
  const raw = String(input || '').trim()
  if (!raw) return ''
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw).hostname.toLowerCase()
  } catch {
    return ''
  }
}

const TTL = 1000 * 60 * 60 * 24 * 7
const MAX = 600
const cache = new Map<string, { body: Buffer; type: string; at: number }>()

async function fetchImage(url: string, timeout = 5000): Promise<{ body: Buffer; type: string } | null> {
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
    if (buf.length < 40 || buf.length > 512 * 1024) return null
    return { body: buf, type: type || 'image/x-icon' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const host = normalize(String(q.url || q.host || ''))
  if (!host || blocked(host)) {
    setResponseStatus(event, 404)
    return ''
  }

  const hit = cache.get(host)
  if (hit && Date.now() - hit.at < TTL) {
    setHeader(event, 'Content-Type', hit.type)
    setHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
    setHeader(event, 'X-Icon-Cache', 'HIT')
    return hit.body
  }

  const candidates = [
    `https://${host}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://favicon.im/${host}`
  ]

  for (const url of candidates) {
    const img = await fetchImage(url)
    if (img) {
      if (cache.size >= MAX) cache.delete(cache.keys().next().value as string)
      cache.set(host, { ...img, at: Date.now() })
      setHeader(event, 'Content-Type', img.type)
      setHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
      setHeader(event, 'X-Icon-Cache', 'MISS')
      return img.body
    }
  }

  setResponseStatus(event, 404)
  return ''
})
