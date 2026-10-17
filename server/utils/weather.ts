import { setDefaultResultOrder } from 'node:dns'

try {
  setDefaultResultOrder('ipv4first')
} catch {}

const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: '晴', icon: 'sun' },
  1: { label: '少云', icon: 'sun-cloud' },
  2: { label: '多云', icon: 'cloud' },
  3: { label: '阴', icon: 'cloud' },
  45: { label: '雾', icon: 'fog' },
  48: { label: '雾凇', icon: 'fog' },
  51: { label: '毛毛雨', icon: 'rain' },
  53: { label: '小雨', icon: 'rain' },
  55: { label: '中雨', icon: 'rain' },
  56: { label: '冻雨', icon: 'rain' },
  57: { label: '冻雨', icon: 'rain' },
  61: { label: '小雨', icon: 'rain' },
  63: { label: '中雨', icon: 'rain' },
  65: { label: '大雨', icon: 'rain' },
  66: { label: '冻雨', icon: 'rain' },
  67: { label: '冻雨', icon: 'rain' },
  71: { label: '小雪', icon: 'snow' },
  73: { label: '中雪', icon: 'snow' },
  75: { label: '大雪', icon: 'snow' },
  77: { label: '雪粒', icon: 'snow' },
  80: { label: '阵雨', icon: 'rain' },
  81: { label: '阵雨', icon: 'rain' },
  82: { label: '强阵雨', icon: 'rain' },
  85: { label: '阵雪', icon: 'snow' },
  86: { label: '阵雪', icon: 'snow' },
  95: { label: '雷阵雨', icon: 'storm' },
  96: { label: '雷阵雨', icon: 'storm' },
  99: { label: '雷暴冰雹', icon: 'storm' }
}

export function weatherInfo(code: number) {
  return WMO[code] || { label: '未知', icon: 'cloud' }
}

export interface GeoResult {
  name: string
  lat: number
  lon: number
  admin1?: string
  country?: string
}

export interface IpLocation {
  lat: number
  lon: number
  city: string
  province: string
  country: string
}

async function fetchJson(url: string, timeout = 6000): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 2077Bot/1.0; +https://my2077.com)', Accept: 'application/json' }
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 通过清秋 IP 接口定位（不传 ip 时使用调用方来源 IP）。 */
export async function locateByIp(ip?: string): Promise<IpLocation | null> {
  const url = ip ? `https://api.hk0.cc/api/ip?ip=${encodeURIComponent(ip)}` : 'https://api.hk0.cc/api/ip'
  const d = await fetchJson(url)
  const loc = d?.data?.location
  const coord = d?.data?.coordinate
  if (!loc || !Array.isArray(coord) || coord.length < 2) return null
  const [lon, lat] = coord
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  return {
    lat,
    lon,
    city: String(loc.city || ''),
    province: String(loc.province || ''),
    country: String(loc.country || '')
  }
}

/** 城市名 → 经纬度（open-meteo geocoding，中文优先）。 */
export async function geocodeCity(name: string): Promise<GeoResult | null> {
  const q = String(name || '').trim()
  if (!q) return null
  const d = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=zh&format=json`
  )
  const r = d?.results?.[0]
  if (!r) return null
  return {
    name: String(r.name || q),
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    admin1: r.admin1 ? String(r.admin1) : '',
    country: r.country ? String(r.country) : ''
  }
}

const weatherCache = new Map<string, { data: any; at: number }>()
const WEATHER_TTL = 1000 * 60 * 10

export async function getWeather(lat: number, lon: number): Promise<any | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
  const hit = weatherCache.get(key)
  if (hit && Date.now() - hit.at < WEATHER_TTL) return hit.data

  const d = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`
  )
  if (!d?.current) return null

  const cur = d.current
  const info = weatherInfo(Number(cur.weather_code))
  const daily = d.daily || {}
  const days = (daily.time || []).slice(0, 3).map((t: string, i: number) => {
    const di = weatherInfo(Number(daily.weather_code?.[i]))
    return {
      date: t,
      label: di.label,
      icon: di.icon,
      max: Math.round(daily.temperature_2m_max?.[i]),
      min: Math.round(daily.temperature_2m_min?.[i])
    }
  })

  const data = {
    temp: Math.round(Number(cur.temperature_2m)),
    feels: Math.round(Number(cur.apparent_temperature)),
    humidity: Number(cur.relative_humidity_2m),
    wind: Math.round(Number(cur.wind_speed_10m)),
    label: info.label,
    icon: info.icon,
    code: Number(cur.weather_code),
    timezone: d.timezone || '',
    days
  }
  if (weatherCache.size >= 500) weatherCache.delete(weatherCache.keys().next().value as string)
  weatherCache.set(key, { data, at: Date.now() })
  return data
}

/** 取调用方真实 IP（nginx 已设置 X-Real-IP / X-Forwarded-For）。 */
export function clientIp(event: any): string {
  const xf = getHeader(event, 'x-forwarded-for')
  if (xf) return String(xf).split(',')[0].trim()
  return getHeader(event, 'x-real-ip') || ''
}
