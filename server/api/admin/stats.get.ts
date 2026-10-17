export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const [[users]]: any = await db.query('SELECT COUNT(*) AS n FROM users')
  const [[links]]: any = await db.query('SELECT COUNT(*) AS n FROM user_links')
  const [[pending]]: any = await db.query("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending'")
  const [[approved]]: any = await db.query("SELECT COUNT(*) AS n FROM submissions WHERE status = 'approved'")
  const [recent]: any = await db.query(
    'SELECT id, name, url, status, created_at FROM submissions ORDER BY id DESC LIMIT 8'
  )
  return {
    stats: {
      users: users.n,
      links: links.n,
      pending: pending.n,
      approved: approved.n
    },
    recent
  }
})
