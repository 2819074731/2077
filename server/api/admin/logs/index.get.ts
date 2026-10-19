export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(100, Math.max(10, Number(q.size) || 20))
  const offset = (page - 1) * size
  const action = String(q.action || '').trim().slice(0, 40)

  const db = useDb()
  const where: string[] = []
  const params: any[] = []
  if (action) {
    where.push('action = ?')
    params.push(action)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [[count]]: any = await db.query(`SELECT COUNT(*) AS n FROM admin_logs ${clause}`, params)
  const [rows]: any = await db.query(
    `SELECT id, user_id, username, action, target, detail, ip, created_at
     FROM admin_logs ${clause} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  const [actions]: any = await db.query(
    'SELECT action, COUNT(*) AS n FROM admin_logs GROUP BY action ORDER BY n DESC'
  )
  return {
    items: rows.map((row: any) => {
      let detail: any = row.detail
      if (typeof detail === 'string') {
        try { detail = JSON.parse(detail) } catch {}
      }
      return { ...row, detail }
    }),
    total: Number(count?.n || 0),
    page,
    size,
    actions
  }
})
