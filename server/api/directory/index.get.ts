const CACHE_TTL = 60 * 1000

interface CountCache<T> {
  at: number
  value: T
}

let categoriesCache: CountCache<any[]> | null = null
let totalCache: CountCache<number> | null = null
let ngramReady: boolean | null = null

async function hasNgram(db: any): Promise<boolean> {
  if (ngramReady !== null) return ngramReady
  try {
    const [[row]]: any = await db.query(
      "SELECT COUNT(*) AS n FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'ngram' AND PLUGIN_STATUS = 'ACTIVE'"
    )
    ngramReady = Number(row?.n || 0) > 0
  } catch {
    ngramReady = false
  }
  return ngramReady
}

async function getCategoryCounts(db: any): Promise<any[]> {
  const now = Date.now()
  if (categoriesCache && now - categoriesCache.at < CACHE_TTL) return categoriesCache.value
  const [rows]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries WHERE status = 'published'
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  categoriesCache = { at: now, value: rows }
  return rows
}

async function getPublishedTotal(db: any): Promise<number> {
  const now = Date.now()
  if (totalCache && now - totalCache.at < CACHE_TTL) return totalCache.value
  const [[row]]: any = await db.query(
    "SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published'"
  )
  const value = Number(row?.n || 0)
  totalCache = { at: now, value }
  return value
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(48, Math.max(1, Number(q.size) || 24))
  const offset = (page - 1) * size
  const category = String(q.category || '').trim().slice(0, 60)
  const kw = String(q.q || '').trim().slice(0, 60)
  const featured = String(q.featured || '') === '1'

  const db = useDb()

  const buildWhere = (fulltext: boolean) => {
    const where = ["status = 'published'"]
    const params: any[] = []
    if (category) {
      where.push('category = ?')
      params.push(category)
    }
    if (featured) where.push('featured = 1')
    if (kw) {
      if (fulltext) {
        where.push('MATCH(name, title, description, keywords) AGAINST (? IN BOOLEAN MODE)')
        params.push(kw)
      } else {
        where.push('(name LIKE ? OR title LIKE ? OR description LIKE ? OR keywords LIKE ? OR url LIKE ?)')
        params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`, `%${kw}%`, `%${kw}%`)
      }
    }
    return { clause: where.join(' AND '), params }
  }

  const queryPage = async (fulltext: boolean) => {
    const { clause, params } = buildWhere(fulltext)
    const [[count]]: any = await db.query(
      `SELECT COUNT(*) AS n FROM directory_entries WHERE ${clause}`,
      params
    )
    const [rows]: any = await db.query(
      `SELECT id, name, url, icon, category, title, description, keywords, featured, detail_enabled, created_at
       FROM directory_entries WHERE ${clause}
       ORDER BY featured DESC, sort ASC, id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    )
    return { total: Number(count?.n || 0), rows }
  }

  let result: { total: number; rows: any[] }
  if (kw.length >= 2 && await hasNgram(db)) {
    try {
      result = await queryPage(true)
      // MariaDB/MySQL 的 ngram 分词对部分混合文本可能返回空结果，空结果时回退 LIKE。
      if (!result.total) result = await queryPage(false)
    } catch {
      result = await queryPage(false)
    }
  } else {
    result = await queryPage(false)
  }

  const [cats, all] = await Promise.all([getCategoryCounts(db), getPublishedTotal(db)])

  if (kw) {
    setHeader(event, 'Cache-Control', 'private, no-store')
  } else if (page === 1) {
    setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  } else {
    setHeader(event, 'Cache-Control', 'private, max-age=30')
  }

  return {
    items: result.rows,
    total: result.total,
    all,
    categories: cats,
    page,
    size
  }
})
