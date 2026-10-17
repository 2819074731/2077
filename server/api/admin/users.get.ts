export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(100, Math.max(1, Number(q.size) || 20))
  const offset = (page - 1) * size
  const kw = String(q.q || '').trim()

  const db = useDb()
  const clause = kw ? 'WHERE email LIKE ? OR nickname LIKE ? OR slug LIKE ?' : ''
  const params = kw ? [`%${kw}%`, `%${kw}%`, `%${kw}%`] : []

  const [countRows]: any = await db.query(`SELECT COUNT(*) AS n FROM users ${clause}`, params)
  const total = countRows[0]?.n || 0

  const [rows]: any = await db.query(
    `SELECT u.id, u.email, u.nickname, u.slug, u.is_admin, u.created_at,
            (SELECT COUNT(*) FROM user_links l WHERE l.user_id = u.id) AS links
     FROM users u ${clause} ORDER BY u.id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  return { items: rows, total, page, size }
})
