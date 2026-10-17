import { getSiteCategories } from '../../../utils/categories'
import { cleanDate } from '../../../utils/sanitize'
import { getMaintenanceStatus } from '../../../utils/directoryMaintenance'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(100, Math.max(1, Number(q.size) || 20))
  const offset = (page - 1) * size
  const category = String(q.category || '').trim().slice(0, 60)
  const status = String(q.status || '').trim().slice(0, 20)
  const from = cleanDate(q.from)
  const to = cleanDate(q.to)
  const kw = String(q.q || '').trim().slice(0, 60)
  const missing = String(q.missing || '') === '1'
  const broken = String(q.broken || '') === '1'

  const db = useDb()
  const where: string[] = []
  const params: any[] = []
  if (category) { where.push('category = ?'); params.push(category) }
  if (status) { where.push('status = ?'); params.push(status) }
  if (from) { where.push('created_at >= ?'); params.push(`${from} 00:00:00`) }
  if (to) { where.push('created_at <= ?'); params.push(`${to} 23:59:59`) }
  if (kw) { where.push('(name LIKE ? OR url LIKE ? OR description LIKE ?)'); params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`) }
  if (missing) where.push("(COALESCE(title, '') = '' OR COALESCE(description, '') = '')")
  if (broken) where.push('(http_status IS NOT NULL AND http_status >= 400 AND http_status NOT IN (401, 403, 412, 429))')
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const [[count]]: any = await db.query(`SELECT COUNT(*) AS n FROM directory_entries ${clause}`, params)
  const [[pub]]: any = await db.query("SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published'")
  const [cats]: any = await db.query(
    `SELECT category, COUNT(*) AS n, SUM(status = 'published') AS published
     FROM directory_entries GROUP BY category ORDER BY n DESC, category ASC`
  )
  const [rows]: any = await db.query(
    `SELECT id, name, url, icon, category, title, description, keywords, content, featured, sort, status, detail_enabled,
       http_status, final_url, checked_at, created_at, updated_at
     FROM directory_entries ${clause} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const counts = new Map<string, any>(cats.map((c: any) => [String(c.category), c]))
  const siteCategories = await getSiteCategories()
  const maintenance = await getMaintenanceStatus()
  const categories: { category: string; n: number; published: number }[] = siteCategories.map((name) => {
    const c: any = counts.get(name)
    counts.delete(name)
    return { category: name, n: Number(c?.n || 0), published: Number(c?.published || 0) }
  })
  for (const c of counts.values()) {
    categories.push({ category: String(c.category), n: Number(c.n || 0), published: Number(c.published || 0) })
  }

  return {
    items: rows,
    total: Number(count?.n || 0),
    published: Number(pub?.n || 0),
    categories,
    maintenance,
    page,
    size
  }
})
