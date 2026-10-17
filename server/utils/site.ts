import { isIP } from 'node:net'
import { safeFetch, readBodyCapped } from './safeUrl'

export interface SiteMeta {
  url: string
  host: string
  title: string
  description: string
  keywords: string
  icon: string
}

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./
]

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return PRIVATE_V4.some((r) => r.test(ip))
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase()
    return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80')
  }
  return false
}

/** 校验并规范化用户提交的 URL，阻断内网/本地地址（SSRF 防护）。 */
export function normalizeSiteUrl(input: string): URL {
  let raw = String(input || '').trim()
  if (!raw) throw createError({ statusCode: 400, statusMessage: '请输入网址' })
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: '网址格式不正确' })
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: '仅支持 http/https 网址' })
  }
  if (u.username || u.password) {
    throw createError({ statusCode: 400, statusMessage: '网址不能包含账号密码' })
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw createError({ statusCode: 400, statusMessage: '不支持的地址' })
  }
  if (isIP(host) && isPrivateIp(host)) {
    throw createError({ statusCode: 400, statusMessage: '不支持的地址' })
  }
  if (u.port && u.port !== '80' && u.port !== '443') {
    throw createError({ statusCode: 400, statusMessage: '仅支持 80/443 端口' })
  }
  u.hash = ''
  return u
}

/** 拉取网页 HTML，自动识别编码并解码。 */
export async function fetchHtml(url: string, timeout = 8000): Promise<{ html: string; finalUrl: string } | null> {
  const hit = await safeFetch(url, {
    timeout,
    headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }
  })
  if (!hit || !hit.res.ok) return null
  const ct = (hit.res.headers.get('content-type') || '').toLowerCase()
  if (ct && !ct.includes('text/html') && !ct.includes('application/xhtml+xml')) return null
  let buf: Buffer
  try {
    buf = await readBodyCapped(hit.res, 2 * 1024 * 1024, timeout)
  } catch {
    return null
  }
  let charset = /charset=([\w-]+)/i.exec(ct)?.[1] || ''
  if (!charset) {
    const head = buf.toString('latin1', 0, 2048)
    charset = /charset=["']?([\w-]+)/i.exec(head)?.[1] || ''
  }
  charset = (charset || 'utf-8').toLowerCase()
  if (charset === 'gb2312' || charset === 'gbk') charset = 'gbk'
  let html = ''
  try {
    html = new TextDecoder(charset).decode(buf)
  } catch {
    html = buf.toString('utf-8')
  }
  return { html, finalUrl: hit.finalUrl }
}

function attr(tag: string, name: string): string {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)
  return m ? m[1].trim() : ''
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .trim()
}

/** 从 HTML 中解析 TDK（title / description / keywords）与图标地址。 */
export function parseMeta(html: string, baseUrl: string): Omit<SiteMeta, 'url' | 'host'> {
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').slice(0, 200)

  let description = ''
  let keywords = ''
  let icon = ''

  const metaTags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of metaTags) {
    const name = (attr(tag, 'name') || attr(tag, 'property')).toLowerCase()
    const content = attr(tag, 'content')
    if (!content) continue
    if (!description && (name === 'description' || name === 'og:description')) description = decodeEntities(content)
    if (!keywords && name === 'keywords') keywords = decodeEntities(content)
    if (!icon && (name === 'og:image' || name === 'twitter:image')) icon = content
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of linkTags) {
    const rel = attr(tag, 'rel').toLowerCase()
    if (rel.includes('icon')) {
      const href = attr(tag, 'href')
      if (href) {
        icon = href
        if (/apple-touch-icon|icon/i.test(rel) && rel !== 'icon') continue
        break
      }
    }
  }

  try {
    if (icon) icon = new URL(icon, baseUrl).toString()
  } catch {
    icon = ''
  }

  return {
    title: title.slice(0, 200),
    description: description.slice(0, 500),
    keywords: keywords.slice(0, 300),
    icon: icon.slice(0, 500)
  }
}

/** 抓取站点 TDK 与图标（用于「一键获取」）。 */
export async function fetchSiteMeta(input: string): Promise<SiteMeta> {
  const u = normalizeSiteUrl(input)
  const host = u.hostname
  const res = await fetchHtml(u.toString())
  const base = res?.finalUrl || u.toString()
  const meta = res ? parseMeta(res.html, base) : { title: '', description: '', keywords: '', icon: '' }
  return { url: u.toString(), host, ...meta }
}
