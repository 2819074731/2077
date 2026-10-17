import { gunzipSync } from 'node:zlib'
import { normalizeSiteUrl } from '../../utils/site'
import { isPrivateHost, readBodyCapped, safeFetch } from '../../utils/safeUrl'
import { getSiteConfig } from '../../utils/siteConfig'

interface Found { url: string; name: string; host: string }

function decode(s: string): string {
  return String(s || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function keyOf(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function parseLinks(html: string, base: string): Found[] {
  const out: Found[] = []
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = decode(m[1])
    if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/')) continue
    let u: URL
    try { u = new URL(raw, base) } catch { continue }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue
    u.hash = ''
    const name = decode(m[2]).slice(0, 80)
    out.push({ url: u.toString(), name, host: u.hostname })
  }
  return out
}

interface SitemapParse { pages: Found[]; sitemaps: string[] }

function sitemapLoc(block: string, base: string): string {
  const m = block.match(/<loc[^>]*>([\s\S]*?)<\/loc>/i)
  if (!m) return ''
  const raw = decode(m[1])
  try {
    const u = new URL(raw, base)
    return /^https?:$/.test(u.protocol) ? u.toString() : ''
  } catch {
    return ''
  }
}

function parseSitemap(xml: string, base: string): SitemapParse {
  const pages: Found[] = []
  const sitemaps: string[] = []
  for (const m of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const loc = sitemapLoc(m[1], base)
    if (!loc) continue
    const u = new URL(loc)
    pages.push({ url: loc, name: u.pathname.replace(/\/+$/, '') || u.hostname, host: u.hostname })
  }
  for (const m of xml.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi)) {
    const loc = sitemapLoc(m[1], base)
    if (loc) sitemaps.push(loc)
  }
  if (!pages.length && !sitemaps.length) {
    for (const m of xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)) {
      const loc = sitemapLoc(m[0], base)
      if (!loc) continue
      const u = new URL(loc)
      pages.push({ url: loc, name: u.pathname.replace(/\/+$/, '') || u.hostname, host: u.hostname })
    }
  }
  return { pages, sitemaps }
}

function unpack(buf: Buffer): Buffer {
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try { return gunzipSync(buf, { maxOutputLength: 8 * 1024 * 1024 }) } catch {}
  }
  return buf
}

interface SitemapState {
  fetched: number
  rootUrl: string
  pages: Found[]
  seenPages: Set<string>
  seenMaps: Set<string>
}

async function readSitemap(url: string, state: SitemapState, depth: number): Promise<void> {
  if (depth > 2 || state.fetched >= 12 || state.pages.length >= 400) return
  const key = keyOf(url)
  if (!key || state.seenMaps.has(key)) return
  state.seenMaps.add(key)
  state.fetched++
  const hit = await safeFetch(url, {
    timeout: 10000,
    headers: { Accept: 'application/xml,text/xml,application/gzip,*/*;q=0.8' }
  }).catch(() => null)
  if (!hit || !hit.res.ok) return
  if (depth === 0) state.rootUrl = hit.finalUrl || url
  let xml = ''
  try {
    const buf = await readBodyCapped(hit.res, 4 * 1024 * 1024, 12000)
    xml = new TextDecoder('utf-8').decode(unpack(buf))
  } catch {
    return
  }
  const parsed = parseSitemap(xml, hit.finalUrl || url)
  for (const page of parsed.pages) {
    const k = keyOf(page.url)
    if (!k || state.seenPages.has(k)) continue
    state.seenPages.add(k)
    state.pages.push(page)
    if (state.pages.length >= 400) break
  }
  if (depth < 2 && state.pages.length < 400) {
    const children = parsed.sitemaps.slice(0, 8)
    await Promise.all(children.map(child => readSitemap(child, state, depth + 1)))
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const mode = String(body?.mode || 'external')
  const u = normalizeSiteUrl(String(body?.url || ''))
  let finalUrl = u.toString()
  let found: Found[] = []
  let sitemaps = 0
  let scanned = 0

  if (mode === 'sitemap') {
    const state: SitemapState = {
      fetched: 0,
      rootUrl: finalUrl,
      pages: [],
      seenPages: new Set(),
      seenMaps: new Set()
    }
    await readSitemap(finalUrl, state, 0)
    finalUrl = state.rootUrl
    found = state.pages
    sitemaps = state.fetched
    scanned = found.length
    if (!sitemaps) throw createError({ statusCode: 502, statusMessage: '抓取失败，请检查 sitemap 地址或稍后再试' })
    if (!found.length) throw createError({ statusCode: 502, statusMessage: '该地址没有可用的 sitemap 页面，请确认地址是否正确' })
  } else {
    const hit = await safeFetch(finalUrl, {
      timeout: 12000,
      headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }
    })
    if (!hit || !hit.res.ok) throw createError({ statusCode: 502, statusMessage: '抓取失败，请检查网址或稍后再试' })
    let buf: Buffer
    try {
      buf = await readBodyCapped(hit.res, 2 * 1024 * 1024, 12000)
    } catch {
      throw createError({ statusCode: 502, statusMessage: '页面过大或读取超时' })
    }
    finalUrl = hit.finalUrl || finalUrl
    found = parseLinks(new TextDecoder('utf-8').decode(buf), finalUrl)
    scanned = found.length
  }

  const baseHost = new URL(finalUrl).hostname
  const db = useDb()
  const [dirRows]: any = await db.query('SELECT url FROM directory_entries')
  const [subRows]: any = await db.query('SELECT url FROM submissions')
  const cfg = await getSiteConfig()
  const known = new Set<string>()
  for (const r of dirRows) { const k = keyOf(r.url); if (k) known.add(k) }
  for (const r of subRows) { const k = keyOf(r.url); if (k) known.add(k) }
  for (const g of cfg.groups) for (const l of g.links) { const k = keyOf(l.url); if (k) known.add(k) }

  const seen = new Set<string>()
  const items: Found[] = []
  for (const f of found) {
    if (isPrivateHost(f.host)) continue
    if (mode === 'external' && f.host === baseHost) continue
    if (mode === 'internal' && f.host !== baseHost) continue
    if (mode === 'sitemap') {
      const a = f.host.replace(/^www\./i, '')
      const b = baseHost.replace(/^www\./i, '')
      if (a !== b && !a.endsWith('.' + b) && !b.endsWith('.' + a)) continue
    }
    const k = keyOf(f.url)
    if (!k || seen.has(k) || known.has(k)) continue
    seen.add(k)
    items.push(f)
    if (items.length >= 200) break
  }

  return {
    source: finalUrl,
    mode,
    total: items.length,
    scanned,
    sitemaps,
    items: items.map(i => ({ url: i.url, name: i.name || i.host, host: i.host }))
  }
})
