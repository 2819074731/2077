import { isIP } from 'node:net'
import { isPrivateIp } from './safeUrl'

const API_BASE = (process.env.IP_LOCATION_API || 'https://api.hk0.cc/api/ip').trim()
const CACHE_TTL = 6 * 60 * 60 * 1000
const CACHE_MAX = 500
const cache = new Map<string, { value: string; at: number }>()

interface IpLocationData {
  country?: string
  province?: string
  city?: string
  district?: string
  isp?: string
}

/** 将接口返回的行政区与运营商拼成紧凑展示串，例如「中国 广东 深圳 · 电信」。 */
export function formatIpLocation(location: IpLocationData | null | undefined): string {
  if (!location || typeof location !== 'object') return ''
  const seen = new Set<string>()
  const region = [location.country, location.province, location.city, location.district]
    .map((part) => String(part || '').trim())
    .filter((part) => {
      if (!part || seen.has(part)) return false
      seen.add(part)
      return true
    })
  const isp = String(location.isp || '').trim()
  return [region.join(' '), isp].filter(Boolean).join(' · ').slice(0, 191)
}

/** 查询公网 IP 归属地；失败时返回空串，不阻塞提交。 */
export async function lookupIpLocation(ip: string): Promise<string> {
  const value = String(ip || '').trim()
  if (!value || !isIP(value) || isPrivateIp(value)) return ''

  const hit = cache.get(value)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value

  let location = ''
  try {
    const url = new URL(API_BASE)
    url.searchParams.set('ip', value)
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(2500)
    })
    if (res.ok) {
      const json: any = await res.json().catch(() => null)
      if (Number(json?.code) === 200) location = formatIpLocation(json?.data?.location)
    }
  } catch {
    location = ''
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(value, { value: location, at: Date.now() })
  return location
}
