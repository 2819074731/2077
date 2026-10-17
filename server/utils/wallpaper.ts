import { setDefaultResultOrder } from 'node:dns'

try {
  setDefaultResultOrder('ipv4first')
} catch {}

export interface Wallpaper {
  id: string
  full: string
  uhd: string
  thumb: string
  title: string
  copyright: string
  date: string
}

let cache: { data: Wallpaper[]; at: number } | null = null
const TTL = 1000 * 60 * 60

async function fetchJson(url: string, timeout = 6000): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 2077Bot/1.0; +https://my2077.com)',
        Accept: 'application/json'
      }
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function buildBase(rawUrl: string): string {
  const path = String(rawUrl || '').split('&')[0]
  return 'https://www.bing.com' + path
}

/** 必应每日壁纸（近 n 天），失败返回空数组。 */
export async function getWallpapers(n = 8): Promise<Wallpaper[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  const count = Math.min(16, Math.max(1, Number(n) || 8))
  const d = await fetchJson(
    `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${count}&mkt=zh-CN`
  )
  const images = Array.isArray(d?.images) ? d.images : []
  const list: Wallpaper[] = images.map((img: any) => {
    const full = buildBase(img.url)
    const base = 'https://www.bing.com' + String(img.urlbase || '')
    const date = String(img.startdate || '')
    const hash = String(img.hsh || '')
    return {
      id: hash || date || full,
      full,
      uhd: `${base}_UHD.jpg`,
      thumb: `${base}_400x240.jpg`,
      title: String(img.title || ''),
      copyright: String(img.copyright || ''),
      date: date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : ''
    }
  })
  if (list.length) cache = { data: list, at: Date.now() }
  return list.length ? list : (cache?.data || [])
}

export function invalidateWallpapers(): void {
  cache = null
}
