import { buildGoogleRelayUrl, isHttpRelay, parseSearchResponse } from '#shared/googleSearch'
import { readBodyCapped, safeFetch } from './safeUrl'

export interface GoogleRelayHealth {
  url: string
  ok: boolean
  status: number
  ms: number
  items: number
  at: number
}

const TTL = 10 * 60 * 1000
const PROBE_TIMEOUT = 6000
const cache = new Map<string, GoogleRelayHealth>()

function snapshot(): Map<string, GoogleRelayHealth> {
  const now = Date.now()
  for (const [key, value] of cache) {
    if (now - value.at > TTL) cache.delete(key)
  }
  return new Map(cache)
}

export async function probeGoogleRelay(template: string): Promise<GoogleRelayHealth> {
  const started = Date.now()
  const base: GoogleRelayHealth = { url: template, ok: false, status: 0, ms: 0, items: 0, at: Date.now() }
  if (!isHttpRelay(template)) {
    base.ms = Date.now() - started
    cache.set(template, base)
    return base
  }

  const url = buildGoogleRelayUrl(template, { q: 'nuxt', page: 1, pageSize: 5, language: 'zh-CN' })
  const hit = await safeFetch(url, {
    timeout: PROBE_TIMEOUT,
    maxRedirects: 3,
    headers: {
      Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
    }
  }).catch(() => null)

  const ms = Date.now() - started
  if (!hit) {
    const failed = { ...base, ms }
    cache.set(template, failed)
    return failed
  }

  const { res, finalUrl } = hit
  let items = 0
  try {
    const body = await readBodyCapped(res, 2 * 1024 * 1024, PROBE_TIMEOUT)
    if (res.ok) {
      const parsed = parseSearchResponse(body.toString('utf8'), res.headers.get('content-type') || '', finalUrl, 5)
      items = parsed.items.length
    }
  } catch {}

  const health: GoogleRelayHealth = {
    url: template,
    ok: res.ok && items > 0,
    status: res.status,
    ms,
    items,
    at: Date.now()
  }
  cache.set(template, health)
  return health
}

export async function probeGoogleRelays(urls: string[]): Promise<GoogleRelayHealth[]> {
  return Promise.all(urls.map(probeGoogleRelay))
}

export function orderGoogleRelays(urls: string[]): string[] {
  const fresh = snapshot()
  if (!fresh.size) return urls
  return urls
    .map((url, index) => {
      const health = fresh.get(url)
      const rank = health ? (health.ok ? 0 : health.status ? 2 : 1) : 1
      return { url, index, rank, ms: health?.ok ? health.ms : Number.MAX_SAFE_INTEGER }
    })
    .sort((a, b) => a.rank - b.rank || a.ms - b.ms || a.index - b.index)
    .map(item => item.url)
}
