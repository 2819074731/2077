import { pinyin } from 'pinyin-pro'
import {
  isValidSearchSort,
  isValidSearchType,
  normalizeQuery,
  splitTokens,
  SEARCH_MAX_PAGE_SIZE,
  SEARCH_PAGE_SIZE,
  type SearchSort,
  type SearchType
} from '#shared/search'
import { getSetting } from './settings'

const INDEX_TTL = 5 * 60 * 1000
const VERSION_CHECK_TTL = 15 * 1000
const MAX_FETCH = 500
const HOT_TTL = 60 * 1000
const CATEGORY_TTL = 5 * 60 * 1000

interface PinyinEntry {
  id: number
  name: string
  full: string
  initials: string
}

interface PinyinCache {
  at: number
  durationMs: number
  version: number
  entries: PinyinEntry[]
  aliases: Map<string, Set<number>>
}

interface HotCache {
  at: number
  items: string[]
}

interface CategoryCache {
  at: number
  items: { category: string; n: number }[]
}

let indexCache: PinyinCache | null = null
let indexBuilding: Promise<PinyinCache> | null = null
let versionCheckedAt = 0
let hotCache: HotCache | null = null
let categoryCache: CategoryCache | null = null

export interface SiteSearchItem {
  type: 'directory' | 'link'
  id: number
  name: string
  url: string
  icon: string
  title: string
  description: string
  category: string
  featured: boolean
  detailEnabled: boolean
  owner: { id: number; nickname: string } | null
  updatedAt: string
  rank: number
}

export interface SiteSearchResult {
  q: string
  tokens: string[]
  type: SearchType
  category: string
  sort: SearchSort
  page: number
  size: number
  total: number
  counts: { all: number; directory: number; link: number }
  items: SiteSearchItem[]
  categories: { category: string; n: number }[]
  hot: string[]
  incomplete: boolean
}

function compact(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function addAlias(map: Map<string, Set<number>>, key: string, id: number) {
  if (key.length < 2) return
  const set = map.get(key)
  if (set) set.add(id)
  else map.set(key, new Set([id]))
}

function pinyinKeys(name: string): { full: string; initials: string } {
  try {
    const full = compact(pinyin(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join(''))
    const initials = compact(pinyin(name, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' }).join(''))
    return { full, initials }
  } catch {
    return { full: '', initials: '' }
  }
}

async function buildIndex(db: any): Promise<PinyinCache> {
  const started = Date.now()
  const version = Number(await getSetting('directory_cache_version', 0)) || 0
  const [rows]: any = await db.query(
    "SELECT id, name FROM directory_entries WHERE status = 'published' AND health_hidden = 0"
  )
  const entries: PinyinEntry[] = []
  const aliases = new Map<string, Set<number>>()
  for (const row of rows) {
    const id = Number(row.id)
    const name = String(row.name || '')
    if (!id || !name) continue
    const keys = pinyinKeys(name)
    entries.push({ id, name, ...keys })
    addAlias(aliases, keys.full, id)
    addAlias(aliases, keys.initials, id)
  }
  const cache: PinyinCache = {
    at: Date.now(),
    durationMs: Date.now() - started,
    version,
    entries,
    aliases
  }
  indexCache = cache
  versionCheckedAt = Date.now()
  return cache
}

export async function ensureSiteSearchIndex(db: any): Promise<PinyinCache> {
  const now = Date.now()
  if (indexCache && now - indexCache.at < INDEX_TTL) {
    if (now - versionCheckedAt > VERSION_CHECK_TTL) {
      versionCheckedAt = now
      try {
        const version = Number(await getSetting('directory_cache_version', 0)) || 0
        if (version !== indexCache.version) indexCache = null
      } catch {}
    }
    if (indexCache) return indexCache
  }
  if (indexBuilding) return indexBuilding
  indexBuilding = buildIndex(db).finally(() => { indexBuilding = null })
  return indexBuilding
}

export function invalidateSiteSearchIndex(): void {
  indexCache = null
  versionCheckedAt = 0
}

export async function rebuildSiteSearchIndex(db: any): Promise<SearchIndexStatus> {
  invalidateSiteSearchIndex()
  await ensureSiteSearchIndex(db)
  return getSiteSearchIndexStatus(db)
}

export interface SearchIndexStatus {
  mode: 'mariadb'
  engine: string
  builtAt: number | null
  ageMs: number | null
  durationMs: number
  ttlMs: number
  directory: number
  links: number
  aliases: number
  pinyin: boolean
}

export async function getSiteSearchIndexStatus(db: any): Promise<SearchIndexStatus> {
  const cache = await ensureSiteSearchIndex(db)
  const [[links]]: any = await db.query('SELECT COUNT(*) AS n FROM user_links WHERE is_public = 1')
  return {
    mode: 'mariadb',
    engine: 'MariaDB LIKE + pinyin-pro',
    builtAt: cache.at,
    ageMs: Date.now() - cache.at,
    durationMs: cache.durationMs,
    ttlMs: INDEX_TTL,
    directory: cache.entries.length,
    links: Number(links?.n || 0),
    aliases: cache.aliases.size,
    pinyin: true
  }
}

function likeValue(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  return `%${escaped}%`
}

function prefixValue(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  return `${escaped}%`
}

function resolvePinyinIds(cache: PinyinCache, tokens: string[]): Map<string, number[]> {
  const out = new Map<string, number[]>()
  for (const token of tokens) {
    const key = compact(token)
    if (!key || key.length < 2 || !/^[a-z0-9]+$/.test(key)) continue
    const ids = new Set<number>()
    for (const [alias, matches] of cache.aliases) {
      if (alias === key || alias.startsWith(key)) {
        for (const id of matches) {
          ids.add(id)
          if (ids.size >= 120) break
        }
      }
      if (ids.size >= 120) break
    }
    if (ids.size) out.set(token, [...ids])
  }
  return out
}

function buildDirectoryFilter(tokens: string[], category: string, pinyinIds: Map<string, number[]>) {
  const where = ["status = 'published'", 'health_hidden = 0']
  const params: any[] = []
  if (category) {
    where.push('category = ?')
    params.push(category)
  }
  for (const token of tokens) {
    const like = likeValue(token)
    const ors = ['name LIKE ?', 'title LIKE ?', 'description LIKE ?', 'keywords LIKE ?', 'url LIKE ?']
    params.push(like, like, like, like, like)
    const ids = pinyinIds.get(token)
    if (ids?.length) {
      ors.push(`id IN (${ids.map(() => '?').join(',')})`)
      params.push(...ids)
    }
    where.push(`(${ors.join(' OR ')})`)
  }
  return { clause: where.join(' AND '), params }
}

function buildLinkFilter(tokens: string[]) {
  const where = ['l.is_public = 1']
  const params: any[] = []
  for (const token of tokens) {
    const like = likeValue(token)
    where.push('(l.name LIKE ? OR l.url LIKE ? OR u.nickname LIKE ?)')
    params.push(like, like, like)
  }
  return { clause: where.join(' AND '), params }
}

async function queryDirectory(
  db: any,
  tokens: string[],
  category: string,
  sort: SearchSort,
  limit: number,
  offset: number,
  primary: string,
  pinyinIds: Map<string, number[]>
) {
  const { clause, params } = buildDirectoryFilter(tokens, category, pinyinIds)
  const [[count]]: any = await db.query(
    `SELECT COUNT(*) AS n FROM directory_entries WHERE ${clause}`,
    params
  )
  const total = Number(count?.n || 0)
  if (!total || !limit) return { total, rows: [] }

  const cases = ['WHEN name = ? THEN 0', 'WHEN name LIKE ? THEN 1']
  const rankParams: any[] = [primary, prefixValue(primary)]
  const priority = pinyinIds.get(primary) || []
  if (priority.length) {
    cases.push(`WHEN id IN (${priority.map(() => '?').join(',')}) THEN 2`)
    rankParams.push(...priority)
  }
  let rank = priority.length ? 3 : 2
  cases.push(`WHEN title LIKE ? THEN ${rank++}`, `WHEN keywords LIKE ? THEN ${rank++}`, `WHEN description LIKE ? THEN ${rank++}`)
  const like = likeValue(primary)
  rankParams.push(like, like, like)
  const rankSql = `CASE ${cases.join(' ')} ELSE ${rank} END`

  const order = sort === 'latest'
    ? 'COALESCE(updated_at, created_at) DESC, id DESC'
    : sort === 'name'
      ? 'CONVERT(name USING gbk) ASC, id DESC'
      : `\`rank\` ASC, featured DESC, sort ASC, COALESCE(updated_at, created_at) DESC, id DESC`

  const [rows]: any = await db.query(
    `SELECT id, name, url, icon, category, title, description, featured, detail_enabled,
       created_at, updated_at, ${rankSql} AS \`rank\`
     FROM directory_entries
     WHERE ${clause}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    [...rankParams, ...params, limit, offset]
  )
  return { total, rows }
}

async function queryLinks(db: any, tokens: string[], sort: SearchSort, limit: number, offset: number, primary: string) {
  const { clause, params } = buildLinkFilter(tokens)
  const [[count]]: any = await db.query(
    `SELECT COUNT(*) AS n FROM user_links l JOIN users u ON u.id = l.user_id WHERE ${clause}`,
    params
  )
  const total = Number(count?.n || 0)
  if (!total || !limit) return { total, rows: [] }

  const rankSql = `CASE WHEN l.name = ? THEN 0 WHEN l.name LIKE ? THEN 1 WHEN u.nickname = ? THEN 2 ELSE 3 END`
  const rankParams = [primary, prefixValue(primary), primary]
  const order = sort === 'latest'
    ? 'l.created_at DESC, l.id DESC'
    : sort === 'name'
      ? 'CONVERT(l.name USING gbk) ASC, l.id DESC'
      : '`rank` ASC, l.sort ASC, l.id DESC'

  const [rows]: any = await db.query(
    `SELECT l.id, l.name, l.url, l.icon, l.created_at,
       u.id AS user_id, u.nickname, ${rankSql} AS \`rank\`
     FROM user_links l JOIN users u ON u.id = l.user_id
     WHERE ${clause}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    [...rankParams, ...params, limit, offset]
  )
  return { total, rows }
}

function iso(value: any): string {
  if (!value) return ''
  try { return new Date(value).toISOString() } catch { return '' }
}

function dateValue(value: string): number {
  const n = Date.parse(value)
  return Number.isFinite(n) ? n : 0
}

function mapDirectory(row: any): SiteSearchItem {
  return {
    type: 'directory',
    id: Number(row.id),
    name: String(row.name || ''),
    url: String(row.url || ''),
    icon: String(row.icon || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    category: String(row.category || ''),
    featured: Number(row.featured) === 1,
    detailEnabled: Number(row.detail_enabled) === 1,
    owner: null,
    updatedAt: iso(row.updated_at || row.created_at),
    rank: Number(row.rank || 0)
  }
}

function mapLink(row: any): SiteSearchItem {
  return {
    type: 'link',
    id: Number(row.id),
    name: String(row.name || ''),
    url: String(row.url || ''),
    icon: String(row.icon || ''),
    title: '',
    description: '',
    category: '',
    featured: false,
    detailEnabled: false,
    owner: row.user_id ? { id: Number(row.user_id), nickname: String(row.nickname || '') } : null,
    updatedAt: iso(row.created_at),
    rank: Number(row.rank || 0)
  }
}

function mergeItems(items: SiteSearchItem[], sort: SearchSort): SiteSearchItem[] {
  if (sort === 'latest') {
    return items.sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt) || (a.type === 'directory' ? -1 : 1))
  }
  if (sort === 'name') {
    return items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || (a.type === 'directory' ? -1 : 1))
  }
  return items.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return b.id - a.id
  })
}

async function getHotTerms(db: any, limit = 8): Promise<string[]> {
  const now = Date.now()
  if (hotCache && now - hotCache.at < HOT_TTL) return hotCache.items.slice(0, limit)
  let items: string[] = []
  try {
    const [rows]: any = await db.query(
      `SELECT term, COUNT(*) AS n FROM search_events
       WHERE engine = 'site' AND kind = 'input' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY term ORDER BY n DESC, MAX(created_at) DESC LIMIT ?`,
      [limit]
    )
    items = rows.map((row: any) => String(row.term || '')).filter(Boolean)
  } catch {}
  if (!items.length) {
    try {
      const [rows]: any = await db.query(
        `SELECT name FROM directory_entries
         WHERE status = 'published' AND health_hidden = 0
         ORDER BY featured DESC, sort ASC, id DESC LIMIT ?`,
        [limit]
      )
      items = rows.map((row: any) => String(row.name || '')).filter(Boolean)
    } catch {}
  }
  hotCache = { at: now, items }
  return items.slice(0, limit)
}

async function getDirectoryCategories(db: any): Promise<{ category: string; n: number }[]> {
  const now = Date.now()
  if (categoryCache && now - categoryCache.at < CATEGORY_TTL) return categoryCache.items
  const [rows]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries
     WHERE status = 'published' AND health_hidden = 0
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  const items = rows.map((row: any) => ({ category: String(row.category || ''), n: Number(row.n || 0) }))
  categoryCache = { at: now, items }
  return items
}

export async function siteSearch(db: any, input: {
  q?: unknown
  type?: unknown
  category?: unknown
  sort?: unknown
  page?: unknown
  size?: unknown
}): Promise<SiteSearchResult> {
  const q = normalizeQuery(input.q)
  const tokens = splitTokens(q)
  let type: SearchType = isValidSearchType(input.type) ? input.type : 'all'
  const category = normalizeQuery(input.category, 60)
  if (category) type = 'directory'
  const sort: SearchSort = isValidSearchSort(input.sort) ? input.sort : 'relevance'
  const page = Math.max(1, Math.min(50, Number(input.page) || 1))
  const size = Math.max(1, Math.min(SEARCH_MAX_PAGE_SIZE, Number(input.size) || SEARCH_PAGE_SIZE))
  const offset = (page - 1) * size
  const fetchLimit = offset >= MAX_FETCH ? 0 : Math.min(MAX_FETCH, offset + size)
  const primary = tokens[0] || q

  if (!tokens.length) {
    const [categories, hot] = await Promise.all([
      getDirectoryCategories(db),
      getHotTerms(db, 8)
    ])
    return {
      q, tokens, type, category, sort, page, size,
      total: 0,
      counts: { all: 0, directory: 0, link: 0 },
      items: [],
      categories,
      hot,
      incomplete: false
    }
  }

  let pinyinIds = new Map<string, number[]>()
  if (tokens.some(token => /^[a-z0-9]+$/i.test(compact(token)))) {
    try {
      const cache = await ensureSiteSearchIndex(db)
      pinyinIds = resolvePinyinIds(cache, tokens)
    } catch {}
  }

  const wantDirectory = type !== 'link'
  const wantLinks = type !== 'directory'
  const [directory, links, categories, hot] = await Promise.all([
    queryDirectory(db, tokens, category, sort, wantDirectory ? fetchLimit : 0, Math.min(offset, MAX_FETCH), primary, pinyinIds),
    category
      ? Promise.resolve({ total: 0, rows: [] as any[] })
      : queryLinks(db, tokens, sort, wantLinks ? fetchLimit : 0, Math.min(offset, MAX_FETCH), primary),
    getDirectoryCategories(db),
    getHotTerms(db, 8)
  ])

  const allItems = [
    ...(wantDirectory ? directory.rows.map(mapDirectory) : []),
    ...(wantLinks ? links.rows.map(mapLink) : [])
  ]
  const merged = mergeItems(allItems, sort).slice(offset, offset + size)
  const total = (wantDirectory ? directory.total : 0) + (wantLinks ? links.total : 0)
  return {
    q, tokens, type, category, sort, page, size,
    total,
    counts: { all: directory.total + links.total, directory: directory.total, link: links.total },
    items: merged,
    categories,
    hot,
    incomplete: total > MAX_FETCH
  }
}

export async function searchSuggestions(db: any, input: unknown, limit: unknown = 8): Promise<string[]> {
  const q = normalizeQuery(input, 60)
  const max = Math.max(1, Math.min(10, Number(limit) || 8))
  if (!q) return getHotTerms(db, max)
  const like = likeValue(q)
  const out: string[] = []
  const seen = new Set<string>()
  const push = (value: unknown) => {
    const text = String(value || '').trim()
    if (!text) return
    const key = text.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(text)
  }

  try {
    let ids: number[] = []
    if (/^[a-z0-9]+$/i.test(compact(q))) {
      const cache = await ensureSiteSearchIndex(db)
      ids = resolvePinyinIds(cache, [q]).get(q) || []
    }
    const ors = ['name LIKE ?', 'keywords LIKE ?']
    const params: any[] = [like, like]
    if (ids.length) {
      ors.push(`id IN (${ids.map(() => '?').join(',')})`)
      params.push(...ids)
    }
    const [rows]: any = await db.query(
      `SELECT name FROM directory_entries
       WHERE status = 'published' AND health_hidden = 0 AND (${ors.join(' OR ')})
       ORDER BY CASE WHEN name = ? THEN 0 WHEN name LIKE ? THEN 1 ELSE 2 END, featured DESC, sort ASC, id DESC
       LIMIT ?`,
      [...params, q, prefixValue(q), max]
    )
    for (const row of rows) push(row.name)
  } catch {}

  if (out.length < max) {
    try {
      const [rows]: any = await db.query(
        `SELECT term, COUNT(*) AS n FROM search_events
         WHERE engine = 'site' AND kind = 'input' AND term LIKE ?
           AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY term ORDER BY n DESC, MAX(created_at) DESC LIMIT ?`,
        [like, max]
      )
      for (const row of rows) push(row.term)
    } catch {}
  }

  return out.slice(0, max)
}

export async function recordSiteSearch(db: any, term: string, results: number, tookMs: number): Promise<void> {
  try {
    await db.execute(
      'INSERT INTO search_events (engine, term, kind, results, took_ms) VALUES (?, ?, ?, ?, ?)',
      ['site', normalizeQuery(term), 'input', Math.max(0, Number(results) || 0), Math.max(0, Math.round(Number(tookMs) || 0))]
    )
  } catch {}
}

export async function recordSiteClick(db: any, term: string): Promise<void> {
  try {
    await db.execute(
      'INSERT INTO search_events (engine, term, kind) VALUES (?, ?, ?)',
      ['site', normalizeQuery(term), 'result_click']
    )
  } catch {}
}
