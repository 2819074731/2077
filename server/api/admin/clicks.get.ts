export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const q = getQuery(event)
  const days = Math.min(Math.max(Number(q.days) || 7, 1), 90)

  const [top]: any = await db.query(
    `SELECT url, name, hits, last_at FROM link_click_agg ORDER BY hits DESC LIMIT 50`
  )

  const [[total]]: any = await db.query('SELECT COUNT(*) AS n FROM link_clicks')
  const [[today]]: any = await db.query(
    'SELECT COUNT(*) AS n FROM link_clicks WHERE created_at >= CURDATE()'
  )
  const [daily]: any = await db.query(
    `SELECT DATE(created_at) AS d, COUNT(*) AS n FROM link_clicks
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at) ORDER BY d ASC`,
    [days - 1]
  )
  const [recent]: any = await db.query(
    'SELECT url, name, user_id, created_at FROM link_clicks ORDER BY id DESC LIMIT 30'
  )

  return {
    top,
    stats: { total: total.n, today: today.n },
    daily,
    recent
  }
})
