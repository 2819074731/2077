export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const days = Math.min(Math.max(Number(q.days) || 7, 1), 30)
  const limit = Math.min(Math.max(Number(q.limit) || 8, 1), 12)
  const category = String(q.category || '').trim().slice(0, 60)

  const db = useDb()
  const params: any[] = [days]
  let categorySql = ''
  if (category) {
    categorySql = 'AND d.category = ?'
    params.push(category)
  }
  params.push(limit)

  const [rows]: any = await db.query(
    `SELECT d.id, d.name, d.url, d.icon, d.category, d.description, d.featured, d.detail_enabled,
       COUNT(DISTINCT CONCAT(COALESCE(c.ip, ''), '|', DATE(c.created_at))) AS hits,
       MAX(c.created_at) AS last_at
     FROM link_clicks c
     JOIN directory_entries d ON d.canonical_key = LOWER(TRIM(TRAILING '/' FROM REGEXP_REPLACE(REGEXP_REPLACE(c.url, '^https?://', ''), '^www[.]', '')))
     WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND d.status = 'published'
       ${categorySql}
     GROUP BY d.id
     ORDER BY hits DESC, last_at DESC
     LIMIT ?`,
    params
  )

  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return {
    days,
    category,
    items: rows.map((row: any) => ({ ...row, hits: Number(row.hits || 0) }))
  }
})
