const CACHE_TTL = 60 * 1000

interface CountCache<T> {
  at: number
  value: T
}

let categoriesCache: CountCache<any[]> | null = null
let totalCache: CountCache<number> | null = null
const provinceCache = new Map<string, CountCache<any[]>>()
const levelCache = new Map<string, CountCache<any[]>>()
const typeCache = new Map<string, CountCache<any[]>>()
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
    `SELECT category, COUNT(*) AS n FROM directory_entries
     WHERE status = 'published' AND health_hidden = 0
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  categoriesCache = { at: now, value: rows }
  return rows
}

async function getProvinceCounts(db: any, category: string): Promise<any[]> {
  const key = category || '*'
  const hit = provinceCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value
  const params: any[] = []
  let clause = "status = 'published' AND health_hidden = 0 AND province <> ''"
  if (category) {
    clause += ' AND category = ?'
    params.push(category)
  }
  const [rows]: any = await db.query(
    `SELECT province, COUNT(*) AS n FROM directory_entries WHERE ${clause}
     GROUP BY province ORDER BY CASE province WHEN '北京市' THEN 1 WHEN '天津市' THEN 2 WHEN '河北省' THEN 3 WHEN '山西省' THEN 4 WHEN '内蒙古自治区' THEN 5 WHEN '辽宁省' THEN 6 WHEN '吉林省' THEN 7 WHEN '黑龙江省' THEN 8 WHEN '上海市' THEN 9 WHEN '江苏省' THEN 10 WHEN '浙江省' THEN 11 WHEN '安徽省' THEN 12 WHEN '福建省' THEN 13 WHEN '江西省' THEN 14 WHEN '山东省' THEN 15 WHEN '河南省' THEN 16 WHEN '湖北省' THEN 17 WHEN '湖南省' THEN 18 WHEN '广东省' THEN 19 WHEN '广西壮族自治区' THEN 20 WHEN '海南省' THEN 21 WHEN '重庆市' THEN 22 WHEN '四川省' THEN 23 WHEN '贵州省' THEN 24 WHEN '云南省' THEN 25 WHEN '西藏自治区' THEN 26 WHEN '陕西省' THEN 27 WHEN '甘肃省' THEN 28 WHEN '青海省' THEN 29 WHEN '宁夏回族自治区' THEN 30 WHEN '新疆维吾尔自治区' THEN 31 WHEN '香港特别行政区' THEN 32 WHEN '澳门特别行政区' THEN 33 WHEN '台湾省' THEN 34 WHEN '海外' THEN 35 ELSE 99 END, n DESC, province ASC`,
    params
  )
  provinceCache.set(key, { at: Date.now(), value: rows })
  return rows
}

async function getPublishedTotal(db: any): Promise<number> {
  const now = Date.now()
  if (totalCache && now - totalCache.at < CACHE_TTL) return totalCache.value
  const [[row]]: any = await db.query(
    "SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published' AND health_hidden = 0"
  )
  const value = Number(row?.n || 0)
  totalCache = { at: now, value }
  return value
}

async function getFacetCounts(db: any, category: string, province: string): Promise<{ levels: any[]; types: any[] }> {
  if (category !== '高校') return { levels: [], types: [] }
  const key = `${category}|${province || '*'}`
  const now = Date.now()
  const cachedLevels = levelCache.get(key)
  const cachedTypes = typeCache.get(key)
  if (cachedLevels && cachedTypes && now - cachedLevels.at < CACHE_TTL && now - cachedTypes.at < CACHE_TTL) {
    return { levels: cachedLevels.value, types: cachedTypes.value }
  }
  const params: any[] = []
  let clause = "status = 'published' AND health_hidden = 0 AND category = '高校'"
  if (province) {
    clause += ' AND province = ?'
    params.push(province)
  }
  const [levels]: any = await db.query(
    `SELECT school_level AS value, COUNT(*) AS n FROM directory_entries
     WHERE ${clause} AND school_level <> ''
     GROUP BY school_level ORDER BY n DESC, school_level ASC`,
    params
  )
  const [types]: any = await db.query(
    `SELECT school_type AS value, COUNT(*) AS n FROM directory_entries
     WHERE ${clause} AND school_type <> ''
     GROUP BY school_type ORDER BY n DESC, school_type ASC`,
    params
  )
  levelCache.set(key, { at: now, value: levels })
  typeCache.set(key, { at: now, value: types })
  return { levels, types }
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(48, Math.max(1, Number(q.size) || 24))
  const offset = (page - 1) * size
  const category = String(q.category || '').trim().slice(0, 60)
  const province = String(q.province || '').trim().slice(0, 40)
  const kw = String(q.q || '').trim().slice(0, 60)
  const featured = String(q.featured || '') === '1'
  const level = String(q.level || '').trim().slice(0, 20)
  const type = String(q.type || '').trim().slice(0, 20)
  const sortRaw = String(q.sort || '')
  const sort = ['latest', 'name'].includes(sortRaw) ? sortRaw : 'recommended'

  const db = useDb()

  const buildWhere = (fulltext: boolean) => {
    const where = ["status = 'published'", 'health_hidden = 0']
    const params: any[] = []
    if (category) {
      where.push('category = ?')
      params.push(category)
    }
    if (province) {
      where.push('province = ?')
      params.push(province)
    }
    if (featured) where.push('featured = 1')
    if (level) {
      where.push('school_level = ?')
      params.push(level)
    }
    if (type) {
      where.push('school_type = ?')
      params.push(type)
    }
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
      `SELECT id, name, url, icon, category, province, city, school_level, school_type, supervisor, title, description, keywords, featured, detail_enabled, created_at
       FROM directory_entries WHERE ${clause}
       ORDER BY ${sort === 'latest' ? 'id DESC' : sort === 'name' ? 'CONVERT(name USING gbk) ASC, id DESC' : 'featured DESC, sort ASC, id DESC'}
       LIMIT ? OFFSET ?`,
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

  const [cats, all, provinces, facets] = await Promise.all([
    getCategoryCounts(db),
    getPublishedTotal(db),
    getProvinceCounts(db, category),
    getFacetCounts(db, category, province)
  ])

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
    provinces,
    levels: facets.levels,
    types: facets.types,
    sort,
    level,
    type,
    page,
    size
  }
})
