import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertPublicHttpUrl, readBodyCapped, safeFetch } from '../utils/safeUrl'

const TTL = 1000 * 60 * 60 * 24 * 7
const NEG_TTL = 1000 * 60 * 10
const MAX_MEM = 600
const MAX_NEG = 5000
const ICON_DIR = process.env.ICON_CACHE_DIR || join(process.cwd(), 'data', 'icons')

interface Cached { body: Buffer; type: string; at: number }

const mem = new Map<string, Cached>()
const neg = new Map<string, number>()

function normalize(input: string): string {
  const raw = String(input || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.hostname.toLowerCase()
  } catch {
    return ''
  }
}

function keyOf(host: string): string {
  return createHash('sha1').update(host).digest('hex')
}

async function diskGet(host: string): Promise<Cached | null> {
  const key = keyOf(host)
  try {
    const meta = JSON.parse(await readFile(join(ICON_DIR, key + '.json'), 'utf8'))
    if (!meta || Date.now() - Number(meta.at) > TTL) return null
    const body = await readFile(join(ICON_DIR, key + '.bin'))
    if (!body.length) return null
    return { body, type: String(meta.type || 'image/x-icon'), at: Number(meta.at) }
  } catch {
    return null
  }
}

async function diskPut(host: string, img: Cached): Promise<void> {
  const key = keyOf(host)
  try {
    await mkdir(ICON_DIR, { recursive: true })
    await writeFile(join(ICON_DIR, key + '.bin'), img.body)
    await writeFile(join(ICON_DIR, key + '.json'), JSON.stringify({ host, type: img.type, at: img.at }))
  } catch {}
}

async function fetchImage(url: string, timeout: number, guarded: boolean): Promise<Cached | null> {
  let res: Response | null = null
  let at = Date.now()
  try {
    if (guarded) {
      const hit = await safeFetch(url, {
        timeout,
        headers: { Accept: 'image/*,*/*;q=0.5' }
      })
      if (!hit) return null
      res = hit.res
      at = Date.now()
    } else {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeout)
      try {
        res = await fetch(url, {
          signal: ctrl.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; 2077Bot/1.0)',
            Accept: 'image/*,*/*;q=0.5'
          }
        })
        at = Date.now()
      } finally {
        clearTimeout(timer)
      }
    }
    if (!res || !res.ok) return null
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (type && !type.startsWith('image/') && type !== 'application/octet-stream') return null
    const body = await readBodyCapped(res, 512 * 1024)
    if (body.length < 40) return null
    return { body, type: type || 'image/x-icon', at }
  } catch {
    return null
  }
}

async function firstImage(
  candidates: Array<{ url: string; guarded: boolean }>,
  deadline: number
): Promise<Cached | null> {
  return new Promise((resolve) => {
    let pending = candidates.length
    let settled = false
    const timer = setTimeout(() => finish(null), deadline)

    function finish(img: Cached | null) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(img)
    }

    for (const c of candidates) {
      fetchImage(c.url, deadline, c.guarded)
        .then((img) => {
          if (img) finish(img)
          else if (!settled) {
            pending -= 1
            if (pending === 0) finish(null)
          }
        })
        .catch(() => {
          if (!settled) {
            pending -= 1
            if (pending === 0) finish(null)
          }
        })
    }
  })
}

function rememberNegative(host: string): void {
  const now = Date.now()
  if (neg.size >= MAX_NEG) {
    for (const [k, exp] of neg) if (exp <= now) neg.delete(k)
    if (neg.size >= MAX_NEG) {
      const oldest = neg.keys().next().value
      if (oldest) neg.delete(oldest)
    }
  }
  neg.set(host, now + NEG_TTL)
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const host = normalize(String(q.url || q.host || ''))
  if (!host) {
    setResponseStatus(event, 404)
    return ''
  }
  try {
    await assertPublicHttpUrl(new URL(`https://${host}`))
  } catch {
    setResponseStatus(event, 404)
    return ''
  }

  const hit = mem.get(host)
  if (hit && Date.now() - hit.at < TTL) {
    setHeader(event, 'Content-Type', hit.type)
    setHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
    setHeader(event, 'X-Icon-Cache', 'MEM')
    return hit.body
  }

  const disk = await diskGet(host)
  if (disk) {
    if (mem.size >= MAX_MEM) mem.delete(mem.keys().next().value as string)
    mem.set(host, disk)
    setHeader(event, 'Content-Type', disk.type)
    setHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
    setHeader(event, 'X-Icon-Cache', 'DISK')
    return disk.body
  }

  const negUntil = neg.get(host)
  if (negUntil) {
    if (negUntil > Date.now()) {
      setResponseStatus(event, 404)
      setHeader(event, 'Cache-Control', 'public, max-age=600')
      setHeader(event, 'X-Icon-Cache', 'NEG')
      return ''
    }
    neg.delete(host)
  }

  // 第一梯队：官网 favicon 与 Google 并行，整体 3.5s 截止，避免单个慢上游拖住请求。
  let img = await firstImage([
    { url: `https://${host}/favicon.ico`, guarded: true },
    { url: `https://www.google.com/s2/favicons?domain=${host}&sz=64`, guarded: false }
  ], 3500)

  // 第二梯队：第一梯队失败后再并行尝试 DuckDuckGo 与 favicon.im。
  if (!img) {
    img = await firstImage([
      { url: `https://icons.duckduckgo.com/ip3/${host}.ico`, guarded: false },
      { url: `https://favicon.im/${host}`, guarded: false }
    ], 2500)
  }

  if (img) {
    if (mem.size >= MAX_MEM) mem.delete(mem.keys().next().value as string)
    mem.set(host, img)
    await diskPut(host, img)
    setHeader(event, 'Content-Type', img.type)
    setHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
    setHeader(event, 'X-Icon-Cache', 'MISS')
    return img.body
  }

  rememberNegative(host)
  setResponseStatus(event, 404)
  setHeader(event, 'Cache-Control', 'public, max-age=600')
  setHeader(event, 'X-Icon-Cache', 'NEG')
  return ''
})
