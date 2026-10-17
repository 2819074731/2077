import { getSiteCategories } from '../../../utils/categories'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(100, Math.max(1, Number(q.size) || 20))
  const offset = (page - 1) * size
  const category = String(q.category || '').trim().slice(0, 60)
  const status = String(q.status || '').trim()
  const kw = String(q.q || '').trim().slice(0, 60)

  const db = useDb()
  const where: string[] = []
  const params: any[] = []
  if (category) { where.push('category = ?'); params.push(category) }
  if (status) { where.push('status = ?'); params.push(status) }
  if (kw) { where.push('(name LIKE ? OR url LIKE ? OR description LIKE ?)'); params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`) }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const [[count]]: any = await db.query(`SELECT COUNT(*) AS n FROM directory_entries ${clause}`, params)
  const [[pub]]: any = await db.query("SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published'")
  const [cats]: any = await db.query(
    `SELECT category, COUNT(*) AS n, SUM(status = 'published') AS published
     FROM directory_entries GROUP BY category ORDER BY n DESC, category ASC`
  )
  const [rows]: any = await db.query(
    `SELECT id, name, url, icon, category, title, description, keywords, content, featured, sort, status, detail_enabled, created_at, updated_at
     FROM directory_entries ${clause} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const counts = new Map<string, any>(cats.map((c: any) => [String(c.category), c]))
  const siteCategories = await getSiteCategories()
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
    page,
    size
  }
})
