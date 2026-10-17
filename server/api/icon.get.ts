import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertPublicHttpUrl, readBodyCapped, safeFetch } from '../../utils/safeUrl'

const TTL = 1000 * 60 * 60 * 24 * 7
const MAX_MEM = 600
const ICON_DIR = process.env.ICON_CACHE_DIR || join(process.cwd(), 'data', 'icons')

interface Cached { body: Buffer; type: string; at: number }

const mem = new Map<string, Cached>()

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

  const candidates: Array<{ url: string; guarded: boolean }> = [
    { url: `https://${host}/favicon.ico`, guarded: true },
    { url: `https://www.google.com/s2/favicons?domain=${host}&sz=64`, guarded: false },
    { url: `https://icons.duckduckgo.com/ip3/${host}.ico`, guarded: false },
    { url: `https://favicon.im/${host}`, guarded: false }
  ]

  for (const c of candidates) {
    const img = await fetchImage(c.url, c.guarded ? 5000 : 4000, c.guarded)
    if (!img) continue
    if (mem.size >= MAX_MEM) mem.delete(mem.keys().next().value as string)
    mem.set(host, img)
    await diskPut(host, img)
    setHeader(event, 'Content-Type', img.type)
    setHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
    setHeader(event, 'X-Icon-Cache', 'MISS')
    return img.body
  }

  setResponseStatus(event, 404)
  return ''
})
