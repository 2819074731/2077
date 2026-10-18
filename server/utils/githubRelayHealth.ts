import { safeFetch } from './safeUrl'

export interface RelayHealth {
  url: string
  ok: boolean
  status: number
  ms: number
  at: number
}

const TTL = 10 * 60 * 1000
const PROBE_TIMEOUT = 5000
const cache = new Map<string, RelayHealth>()

export function relayHealthSnapshot(): Map<string, RelayHealth> {
  const now = Date.now()
  for (const [key, value] of cache) {
    if (now - value.at > TTL) cache.delete(key)
  }
  return new Map(cache)
}

export async function probeRelay(url: string): Promise<RelayHealth> {
  const started = Date.now()
  const result = await safeFetch(`${url}/https://api.github.com/search/repositories?q=nuxt&per_page=1`, {
    timeout: PROBE_TIMEOUT,
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': '2077Bot/1.0 (+https://my2077.com)' },
    maxRedirects: 2
  }).catch(() => null)
  const ms = Date.now() - started
  const health: RelayHealth = {
    url,
    ok: Boolean(result?.res.ok),
    status: result?.res.status || 0,
    ms,
    at: Date.now()
  }
  cache.set(url, health)
  return health
}

export async function probeRelays(urls: string[]): Promise<RelayHealth[]> {
  return Promise.all(urls.map(probeRelay))
}

export function orderRelays(urls: string[]): string[] {
  const fresh = relayHealthSnapshot()
  if (!fresh.size) return urls
  return urls
    .map((url, index) => {
      const health = fresh.get(url)
      const rank = health ? (health.ok ? 0 : 2) : 1
      return { url, index, rank, ms: health?.ms ?? Number.MAX_SAFE_INTEGER }
    })
    .sort((a, b) => a.rank - b.rank || a.ms - b.ms || a.index - b.index)
    .map(item => item.url)
}
