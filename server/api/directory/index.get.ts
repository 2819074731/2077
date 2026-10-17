export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(48, Math.max(1, Number(q.size) || 24))
  const offset = (page - 1) * size
  const category = String(q.category || '').trim().slice(0, 60)
  const kw = String(q.q || '').trim().slice(0, 60)
  const featured = String(q.featured || '') === '1'

  const db = useDb()
  const where = ["status = 'published'"]
  const params: any[] = []
  if (category) { where.push('category = ?'); params.push(category) }
  if (featured) where.push('featured = 1')
  if (kw) { where.push('(name LIKE ? OR description LIKE ? OR keywords LIKE ? OR url LIKE ?)'); params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`, `%${kw}%`) }
  const clause = 'WHERE ' + where.join(' AND ')

  const [[count]]: any = await db.query(`SELECT COUNT(*) AS n FROM directory_entries ${clause}`, params)
  const [rows]: any = await db.query(
    `SELECT id, name, url, icon, category, title, description, keywords, featured, detail_enabled, created_at
     FROM directory_entries ${clause}
     ORDER BY featured DESC, sort ASC, id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const [cats]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries WHERE status = 'published'
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  const [[all]]: any = await db.query("SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published'")

  return {
    items: rows,
    total: Number(count?.n || 0),
    all: Number(all?.n || 0),
    categories: cats,
    page,
    size
  }
})
