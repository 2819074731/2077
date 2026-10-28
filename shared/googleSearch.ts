export interface GoogleSearchItem {
  title: string
  url: string
  displayUrl: string
  snippet: string
}

export interface GoogleSearchPayload {
  items: GoogleSearchItem[]
  hasMore: boolean
}

export interface GoogleRelayQuery {
  q: string
  page: number
  pageSize: number
  language?: string
  safeSearch?: boolean
}

const HTML_NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  middot: '·',
  laquo: '«',
  raquo: '»',
  copy: '©'
}

const SKIP_HOSTS = [
  'google.com',
  'googleusercontent.com',
  'gstatic.com',
  'googleapis.com'
]

const SKIP_PATHS = [
  '/search',
  '/preferences',
  '/advanced_search',
  '/setprefs',
  '/accounts',
  '/policies',
  '/support',
  '/websearch',
  '/webhp',
  '/sorry',
  '/url',
  '/imgres'
]

export function decodeEntities(input: unknown): string {
  return String(input ?? '').replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code[0] === '#') {
      const hex = code[1] === 'x' || code[1] === 'X'
      const value = Number.parseInt(hex ? code.slice(2) : code.slice(1), hex ? 16 : 10)
      if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return match
      try {
        return String.fromCodePoint(value)
      } catch {
        return match
      }
    }
    return HTML_NAMED[code.toLowerCase()] ?? match
  })
}

export function normalizeGoogleQuery(value: unknown, max = 120): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function text(value: unknown, max: number): string {
  return stripTags(String(value ?? '')).slice(0, max)
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function noisyUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()
  if (host === 'google.com' || host === 'www.google.com') {
    if (!path || path === '/') return true
    return SKIP_PATHS.some(item => path === item || path.startsWith(`${item}/`))
  }
  if (host.endsWith('.google.com')) return true
  return SKIP_HOSTS.some(item => host === item || host.endsWith(`.${item}`))
}

export function unwrapSearchUrl(raw: unknown, base: string): string {
  let current = decodeEntities(raw).trim()
  if (!current || current.startsWith('#') || /^javascript:/i.test(current) || /^mailto:/i.test(current)) return ''

  for (let hop = 0; hop < 3; hop++) {
    let url: URL
    try {
      url = new URL(current, base)
    } catch {
      return ''
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    if (url.pathname === '/url' || url.pathname === '/url/') {
      const target = url.searchParams.get('q') || url.searchParams.get('url') || url.searchParams.get('u')
      if (!target) return ''
      current = target
      continue
    }
    if (url.hostname === 'l.instagram.com' || url.hostname === 'out.reddit.com') {
      const target = url.searchParams.get('u') || url.searchParams.get('url')
      if (!target) return ''
      current = target
      continue
    }
    if (noisyUrl(url)) return ''
    url.hash = ''
    return url.href
  }
  return ''
}

function itemKey(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`
  } catch {
    return url
  }
}

function pushItem(items: GoogleSearchItem[], seen: Set<string>, title: string, url: string, snippet: string): void {
  const cleanTitle = text(title, 220)
  if (!url || cleanTitle.length < 2) return
  const key = itemKey(url)
  if (!key || seen.has(key)) return
  seen.add(key)
  items.push({
    title: cleanTitle,
    url,
    displayUrl: hostOf(url),
    snippet: text(snippet, 400)
  })
}

function anchorHref(attrs: string): string {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs)
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : ''
}

function snippetAfter(html: string, end: number): string {
  const rest = html.slice(end, end + 1200)
  const wrapper = /^\s*<(?:div|p|li|section|article|tr|table|dd|td)\b[^>]*>/i.exec(rest)
  const body = wrapper ? rest.slice(wrapper[0].length) : rest
  const cut = body.search(/<\/?(?:div|li|tr|table|section|article|p|dd|td)\b/i)
  const picked = cut === -1 ? body : body.slice(0, cut)
  return stripTags(picked.slice(0, 500))
}

export function parseSerpHtml(html: string, base: string): GoogleSearchItem[] {
  const items: GoogleSearchItem[] = []
  const seen = new Set<string>()
  const source = String(html ?? '')
  if (!source) return items

  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  const pending: Array<{ attrs: string; inner: string; start: number; after: string }> = []
  let match: RegExpExecArray | null
  while ((match = anchor.exec(source))) {
    pending.push({
      attrs: match[1] || '',
      inner: match[2] || '',
      start: match.index,
      after: snippetAfter(source, anchor.lastIndex)
    })
  }

  for (const row of pending) {
    const h3 = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(row.inner)
    if (!h3) continue
    const url = unwrapSearchUrl(anchorHref(row.attrs), base)
    if (!url) continue
    pushItem(items, seen, h3[1] || '', url, row.after)
  }

  if (!items.length) {
    for (const row of pending) {
      if (!/class\s*=\s*(?:"[^"]*result[^"]*"|'[^']*result[^']*')/i.test(row.attrs)) continue
      const url = unwrapSearchUrl(anchorHref(row.attrs), base)
      if (!url) continue
      pushItem(items, seen, row.inner, url, row.after)
    }
  }

  if (!items.length) {
    for (const row of pending) {
      const nearby = source.slice(Math.max(0, row.start - 180), row.start)
      if (!/<h2\b/i.test(nearby)) continue
      const url = unwrapSearchUrl(anchorHref(row.attrs), base)
      if (!url) continue
      const title = stripTags(row.inner)
      if (title.length < 6 || title.length > 200) continue
      pushItem(items, seen, title, url, row.after)
    }
  }

  return items.slice(0, 30)
}

function arrayFromJson(data: any): any[] {
  if (!data || typeof data !== 'object') return []
  const candidates = [data.results, data.items, data.organic, data.data, data.web?.results, data.response?.results, data.hits]
  for (const value of candidates) {
    if (Array.isArray(value)) return value
  }
  return Array.isArray(data) ? data : []
}

function jsonHasMore(data: any, count: number, pageSize: number): boolean {
  if (!data || typeof data !== 'object') return count >= pageSize
  if (Array.isArray(data.queries?.nextPage) && data.queries.nextPage.length) return true
  if (data.has_more === true || data.hasMore === true || data.next_page || data.nextPage) return true
  return count >= pageSize
}

export function parseSearchJson(data: any, base: string, pageSize: number): GoogleSearchPayload {
  const items: GoogleSearchItem[] = []
  const seen = new Set<string>()
  for (const raw of arrayFromJson(data)) {
    if (!raw || typeof raw !== 'object') continue
    const link = raw.url || raw.link || raw.href || raw.sourceURL || ''
    const url = unwrapSearchUrl(link, base)
    if (!url) continue
    const title = raw.title || raw.name || raw.heading || raw.text || ''
    const snippet = raw.snippet || raw.content || raw.description || raw.body || raw.highlight?.body || ''
    pushItem(items, seen, title, url, snippet)
  }
  return {
    items: items.slice(0, 30),
    hasMore: jsonHasMore(data, items.length, pageSize)
  }
}

export function parseSearchResponse(
  body: string,
  contentType: string,
  base: string,
  pageSize: number
): GoogleSearchPayload {
  const raw = String(body ?? '')
  const type = String(contentType || '').toLowerCase()
  const trimmed = raw.trimStart()
  const looksJson = type.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')
  if (looksJson && trimmed) {
    try {
      const data = JSON.parse(trimmed)
      const parsed = parseSearchJson(data, base, pageSize)
      if (parsed.items.length) return parsed
    } catch {}
  }
  const items = parseSerpHtml(raw, base)
  return { items, hasMore: items.length >= pageSize }
}

export function buildGoogleRelayUrl(template: string, query: GoogleRelayQuery): string {
  const base = String(template || '').trim()
  const language = query.language || 'zh-CN'
  const isTemplate = base.includes('%s')
  let url = isTemplate ? base : `${base.replace(/\/+$/, '')}/search?q=%s&format=json`

  url = url
    .replace(/%pageno%/g, String(query.page))
    .replace(/%start%/g, String((query.page - 1) * query.pageSize + 1))
    .replace(/%lang%/g, encodeURIComponent(language))
    .replace(/%pagesize%/g, String(query.pageSize))
    .replace(/%s/g, encodeURIComponent(query.q))

  if (!isTemplate) {
    url += `&language=${encodeURIComponent(language)}&safesearch=${query.safeSearch ? 1 : 0}`
  }

  if (query.page > 1 && !base.includes('%pageno%') && !base.includes('%start%')) {
    const joiner = url.includes('?') ? '&' : '?'
    url += /googleapis\.com/i.test(url) ? `${joiner}start=${(query.page - 1) * query.pageSize + 1}` : `${joiner}pageno=${query.page}`
  }

  return url
}

export function isHttpRelay(value: unknown): boolean {
  try {
    const url = new URL(String(value ?? '').trim())
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash
  } catch {
    return false
  }
}
