import { withDefaultAvatar } from '../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const size = Math.min(100, Math.max(1, Number(q.size) || 20))
  const offset = (page - 1) * size
  const kw = String(q.q || '').trim()
  const role = String(q.role || '').trim()

  const db = useDb()
  const where: string[] = []
  const params: any[] = []
  if (kw) {
    where.push('(email LIKE ? OR username LIKE ? OR nickname LIKE ? OR slug LIKE ? OR qq LIKE ?)')
    params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`, `%${kw}%`, `%${kw}%`)
  }
  if (role === 'admin') where.push('is_admin = 1')
  if (role === 'user') where.push('is_admin = 0')
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const [countRows]: any = await db.query(`SELECT COUNT(*) AS n FROM users ${clause}`, params)
  const total = countRows[0]?.n || 0

  const [rows]: any = await db.query(
    `SELECT u.id, u.email, u.username, u.nickname, u.avatar, u.qq, u.slug, u.is_admin, u.created_at,
            (SELECT COUNT(*) FROM user_links l WHERE l.user_id = u.id) AS links
     FROM users u ${clause} ORDER BY u.id DESC LIMIT ${size} OFFSET ${offset}`,
    params
  )
  return { items: rows.map((u: any) => withDefaultAvatar(u)), total, page, size }
})
