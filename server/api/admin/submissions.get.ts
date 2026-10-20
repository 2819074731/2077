import { cleanDate } from '../../utils/sanitize'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const status = String(q.status || '').trim().slice(0, 20)
  const category = String(q.category || '').trim().slice(0, 60)
  const from = cleanDate(q.from)
  const to = cleanDate(q.to)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(100, Math.max(1, Number(q.size) || 20))
  const offset = (page - 1) * size
  const kw = String(q.q || '').trim().slice(0, 60)

  const db = useDb()
  const where: string[] = []
  const params: any[] = []
  if (status) { where.push('status = ?'); params.push(status) }
  if (category) { where.push('grp = ?'); params.push(category) }
  if (from) { where.push('created_at >= ?'); params.push(`${from} 00:00:00`) }
  if (to) { where.push('created_at <= ?'); params.push(`${to} 23:59:59`) }
  if (kw) { where.push('(name LIKE ? OR url LIKE ?)'); params.push(`%${kw}%`, `%${kw}%`) }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const [countRows]: any = await db.query(`SELECT COUNT(*) AS n FROM submissions ${clause}`, params)
  const total = countRows[0]?.n || 0

  const [rows]: any = await db.query(
    `SELECT id, user_id, submitter_ip, name, url, icon, title, description, keywords, grp, target, status, created_at
     FROM submissions ${clause} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  return { items: rows, total, page, size }
})
