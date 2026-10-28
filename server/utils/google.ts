import {
  buildGoogleRelayUrl,
  isHttpRelay,
  normalizeGoogleQuery,
  parseSearchResponse,
  type GoogleSearchItem
} from '#shared/googleSearch'
import type { GoogleSearchSettings } from '#shared/siteSettings'
import { readBodyCapped, safeFetch } from './safeUrl'
import { getGoogleSearchSettings } from './googleSettings'
import { orderGoogleRelays } from './googleRelayHealth'

const MAX_CACHE = 200
const MAX_BODY = 3 * 1024 * 1024

export interface GoogleSearchResult {
  q: string
  page: number
  pageSize: number
  items: GoogleSearchItem[]
  hasMore: boolean
  relay: string
  cached: boolean
  tookMs: number
}

interface Entry<T> { value: T; at: number }

const searchCache = new Map<string, Entry<GoogleSearchResult>>()
const searchInflight = new Map<string, Promise<GoogleSearchResult>>()

export function resolveGoogleRelays(settings: GoogleSearchSettings): string[] {
  const configured = settings.relays.length
    ? settings.relays
    : String(process.env.GOOGLE_SEARCH_RELAYS || '').split(',')
  const result: string[] = []
  for (const value of configured) {
    const raw = String(value || '').trim()
    if (!raw || !isHttpRelay(raw) || result.includes(raw)) continue
    result.push(raw)
    if (result.length >= 6) break
  }
  return result
}

function cacheGet<T>(map: Map<string, Entry<T>>, key: string, ttl: number): T | undefined {
  const hit = map.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > ttl) {
    map.delete(key)
    return undefined
  }
  return hit.value
}

function cachePut<T>(map: Map<string, Entry<T>>, key: string, value: T): void {
  if (map.size >= MAX_CACHE) {
    const oldest = map.keys().next().value
    if (oldest) map.delete(oldest)
  }
  map.set(key, { value, at: Date.now() })
}

function relayLabel(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function decodeBody(body: Buffer, contentType: string): string {
  const charset = /charset\s*=\s*"?([\w-]+)/i.exec(contentType)?.[1]
  if (charset && !/^utf-?8$/i.test(charset)) {
    try {
      return new TextDecoder(charset).decode(body)
    } catch {}
  }
  return body.toString('utf8')
}

async function fetchRelay(url: string, timeout: number): Promise<{ body: string; contentType: string; finalUrl: string }> {
  const hit = await safeFetch(url, {
    timeout,
    maxRedirects: 3,
    headers: {
      Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
    }
  })
  if (!hit) throw new Error('relay-unreachable')
  const { res, finalUrl } = hit
  if (!res.ok) throw new Error(`relay-${res.status}`)
  const body = await readBodyCapped(res, MAX_BODY, timeout)
  return {
    body: decodeBody(body, res.headers.get('content-type') || ''),
    contentType: res.headers.get('content-type') || '',
    finalUrl
  }
}

export async function searchGoogle(query: string, page = 1): Promise<GoogleSearchResult> {
  const q = normalizeGoogleQuery(query)
  if (!q) throw createError({ statusCode: 400, statusMessage: '请输入搜索关键词' })

  const settings = await getGoogleSearchSettings()
  const pageSize = Math.max(10, Math.min(30, Number(settings.pageSize) || 10))
  const maxPages = Math.max(1, Math.min(10, Number(settings.maxPages) || 5))
  const currentPage = Math.max(1, Math.min(maxPages, Number(page) || 1))
  const timeout = Math.max(2000, Math.min(15000, Number(settings.timeoutMs) || 6000))
  const ttl = Math.max(60, Number(settings.cacheSec) || 300) * 1000
  const relays = resolveGoogleRelays(settings)

  if (!relays.length) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Google 中转尚未配置，请在后台引擎设置中添加线路'
    })
  }

  const key = `${currentPage}:${pageSize}:${settings.language}:${Number(settings.safeSearch)}:${q.toLowerCase()}`
  const cached = cacheGet(searchCache, key, ttl)
  if (cached !== undefined) return { ...cached, cached: true }

  const running = searchInflight.get(key)
  if (running) return running

  const task = (async () => {
    const started = Date.now()
    let firstError: any = null
    let empty: GoogleSearchResult | null = null

    for (const relay of orderGoogleRelays(relays)) {
      const url = buildGoogleRelayUrl(relay, {
        q: q,
        page: currentPage,
        pageSize,
        language: settings.language,
        safeSearch: settings.safeSearch
      })
      try {
        const payload = await fetchRelay(url, timeout)
        const parsed = parseSearchResponse(payload.body, payload.contentType, payload.finalUrl, pageSize)
        const result: GoogleSearchResult = {
          q,
          page: currentPage,
          pageSize,
          items: parsed.items,
          hasMore: parsed.hasMore || parsed.items.length >= pageSize,
          relay: relayLabel(relay),
          cached: false,
          tookMs: Date.now() - started
        }
        if (!result.items.length) {
          empty = result
          continue
        }
        cachePut(searchCache, key, result)
        return result
      } catch (error: any) {
        if (!firstError) firstError = error
        console.warn('[google-search] relay failed:', relayLabel(relay), error?.message || error)
      }
    }

    if (empty) return empty

    throw createError({
      statusCode: 502,
      statusMessage: 'Google 中转暂时不可用，请稍后重试',
      data: { reason: firstError?.message || 'relay-failed' }
    })
  })().finally(() => { searchInflight.delete(key) })

  searchInflight.set(key, task)
  return task
}
