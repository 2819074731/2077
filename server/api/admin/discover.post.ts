import { normalizeSiteUrl } from '../../utils/site'
import { isPrivateHost, readBodyCapped, safeFetch } from '../../utils/safeUrl'
import { getSiteConfig } from '../../utils/siteConfig'

interface Found { url: string; name: string; host: string }

function decode(s: string): string {
  return String(s || '')
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

function parseSitemap(xml: string, base: string): Found[] {
  const out: Found[] = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    let u: URL
    try { u = new URL(m[1], base) } catch { continue }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue
    out.push({ url: u.toString(), name: u.pathname.replace(/\/+$/, '') || u.hostname, host: u.hostname })
  }
  return out
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const mode = String(body?.mode || 'external')
  const u = normalizeSiteUrl(String(body?.url || ''))
  const hit = await safeFetch(u.toString(), {
    timeout: 12000,
    headers: { Accept: mode === 'sitemap' ? 'application/xml,text/xml,*/*;q=0.8' : 'text/html,application/xhtml+xml,*/*;q=0.8' }
  })
  if (!hit || !hit.res.ok) throw createError({ statusCode: 502, statusMessage: '抓取失败，请检查网址或稍后再试' })
  let buf: Buffer
  try {
    buf = await readBodyCapped(hit.res, 2 * 1024 * 1024, 12000)
  } catch {
    throw createError({ statusCode: 502, statusMessage: '页面过大或读取超时' })
  }
  const text = new TextDecoder('utf-8').decode(buf)
  const finalUrl = hit.finalUrl || u.toString()

  let found: Found[] = []
  if (mode === 'sitemap') {
    found = parseSitemap(text, finalUrl)
    const childSitemaps = found.filter(f => /\.xml(\.gz)?$/i.test(f.url)).slice(0, 5)
    if (childSitemaps.length && found.every(f => /\.xml(\.gz)?$/i.test(f.url))) {
      const merged: Found[] = []
      for (const child of childSitemaps) {
        const sub = await safeFetch(child.url, { timeout: 10000 }).catch(() => null)
        if (!sub || !sub.res.ok) continue
        try {
          const b = await readBodyCapped(sub.res, 2 * 1024 * 1024, 10000)
          merged.push(...parseSitemap(new TextDecoder('utf-8').decode(b), child.url))
        } catch {}
        if (merged.length >= 300) break
      }
      if (merged.length) found = merged
    }
  } else {
    found = parseLinks(text, finalUrl)
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
    if (mode === 'sitemap' && !f.url.startsWith(new URL(finalUrl).origin)) continue
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
    items: items.map(i => ({ url: i.url, name: i.name || i.host, host: i.host }))
  }
})
