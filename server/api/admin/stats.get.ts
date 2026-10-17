export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const [[users]]: any = await db.query('SELECT COUNT(*) AS n FROM users')
  const [[links]]: any = await db.query('SELECT COUNT(*) AS n FROM user_links')
  const [[pending]]: any = await db.query("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending'")
  const [[approved]]: any = await db.query("SELECT COUNT(*) AS n FROM submissions WHERE status = 'approved'")
  const [[directory]]: any = await db.query("SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published'")
  const [[traffic]]: any = await db.query(
    `SELECT SUM(is_bot = 0) AS pv, COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv, SUM(is_bot = 1) AS bot
     FROM traffic_log WHERE day = CURDATE()`
  )
  const [recent]: any = await db.query(
    'SELECT id, name, url, status, created_at FROM submissions ORDER BY id DESC LIMIT 8'
  )
  return {
    stats: {
      users: users.n,
      links: links.n,
      pending: pending.n,
      approved: approved.n,
      directory: directory.n,
      todayPv: Number(traffic?.pv || 0),
      todayUv: Number(traffic?.uv || 0),
      todayBot: Number(traffic?.bot || 0)
    },
    recent
  }
})
