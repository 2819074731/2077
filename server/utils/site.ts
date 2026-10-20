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
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache'
}

export async function fetchHtml(url: string, timeout = 9000): Promise<{ html: string; finalUrl: string } | null> {
  const hit = await safeFetch(url, {
    timeout,
    headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
  })
  if (!hit || !hit.res.ok) return null
  const ct = (hit.res.headers.get('content-type') || '').toLowerCase()
  if (ct && !ct.includes('text/html') && !ct.includes('application/xhtml+xml')) return null
  let buf: Buffer
  try {
    buf = await readBodyCapped(hit.res, 2 * 1024 * 1024, timeout, true)
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
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag)
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim()
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

function metaMap(html: string): Map<string, string> {
  const map = new Map<string, string>()
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    const name = (attr(tag, 'name') || attr(tag, 'property') || attr(tag, 'itemprop')).toLowerCase()
    const content = decodeEntities(attr(tag, 'content'))
    if (name && content && !map.has(name)) map.set(name, content)
  }
  return map
}

function jsonLdMeta(html: string): { title: string; description: string } {
  let title = ''
  let description = ''
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!title && typeof value.name === 'string') title = value.name
    if (!title && typeof value.headline === 'string') title = value.headline
    if (!description && typeof value.description === 'string') description = value.description
    if (value['@graph']) visit(value['@graph'])
  }
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '')
    try {
      visit(JSON.parse(body))
    } catch {}
    if (title && description) break
  }
  return { title: decodeEntities(title), description: decodeEntities(description) }
}

/** 从 HTML 中解析 TDK（title / description / keywords）与图标地址。 */
export function parseMeta(html: string, baseUrl: string): Omit<SiteMeta, 'url' | 'host'> {
  const rawTitle = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '')
  const metas = metaMap(html)
  const ld = rawTitle && (metas.get('description') || metas.get('og:description'))
    ? { title: '', description: '' }
    : jsonLdMeta(html)

  const title = rawTitle
    || metas.get('og:title')
    || metas.get('twitter:title')
    || ld.title
    || metas.get('og:site_name')
    || ''

  const description = metas.get('description')
    || metas.get('og:description')
    || metas.get('twitter:description')
    || ld.description
    || ''

  const keywords = metas.get('keywords')
    || metas.get('news_keywords')
    || ''

  let icon = metas.get('og:image')
    || metas.get('og:image:url')
    || metas.get('twitter:image')
    || ''

  const linkTags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of linkTags) {
    const rel = attr(tag, 'rel').toLowerCase()
    if (!rel.includes('icon')) continue
    const href = attr(tag, 'href')
    if (href) {
      icon = href
      break
    }
  }

  try {
    if (/^data:/i.test(icon)) icon = ''
    else if (icon) icon = new URL(icon, baseUrl).toString()
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

function metaScore(meta: Omit<SiteMeta, 'url' | 'host'>): number {
  const blocked = /just a moment|attention required|checking your browser|安全验证|验证中心|访问验证/i.test(meta.title)
  if (blocked) return 0
  return (meta.title ? 2 : 0) + (meta.description ? 2 : 0) + (meta.keywords ? 1 : 0) + (meta.icon ? 1 : 0)
}

function candidateUrls(u: URL): string[] {
  const list = [u.toString()]
  if (!isIP(u.hostname) && !u.hostname.startsWith('www.')) {
    const www = new URL(u.toString())
    www.hostname = `www.${u.hostname}`
    list.push(www.toString())
  }
  const alt = new URL(u.toString())
  alt.protocol = u.protocol === 'https:' ? 'http:' : 'https:'
  list.push(alt.toString())
  return [...new Set(list)]
}

/** 抓取站点 TDK 与图标（用于「一键获取」）。 */
export async function fetchSiteMeta(input: string): Promise<SiteMeta> {
  const u = normalizeSiteUrl(input)
  const host = u.hostname
  const empty = { title: '', description: '', keywords: '', icon: '' }
  const candidates = candidateUrls(u)
  let best = empty
  let bestScore = 0

  const firstUrl = candidates[0]
  const first = firstUrl ? await fetchHtml(firstUrl) : null
  if (first) {
    const meta = parseMeta(first.html, first.finalUrl)
    best = meta
    bestScore = metaScore(meta)
    if (bestScore >= 4) return { url: u.toString(), host, ...best }
  }

  const rest = await Promise.all(candidates.slice(1).map(url => fetchHtml(url, 6000)))
  for (const res of rest) {
    if (!res) continue
    const meta = parseMeta(res.html, res.finalUrl)
    const score = metaScore(meta)
    if (score > bestScore) {
      best = meta
      bestScore = score
    }
  }

  return { url: u.toString(), host, ...best }
}
