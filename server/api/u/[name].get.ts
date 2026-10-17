import { qqAvatarUrl } from '../../utils/user'

export default defineEventHandler(async (event) => {
  const key = String(getRouterParam(event, 'name') || '').trim()
  if (!key) throw createError({ statusCode: 400, statusMessage: '无效用户' })
  const db = useDb()
  const isId = /^\d+$/.test(key)
  const [rows]: any = await db.query(
    isId
      ? 'SELECT id, nickname, avatar, qq FROM users WHERE id = ? LIMIT 1'
      : 'SELECT id, nickname, avatar, qq FROM users WHERE slug = ? LIMIT 1',
    [isId ? Number(key) : key]
  )
  const u = rows[0]
  if (!u) throw createError({ statusCode: 404, statusMessage: '未找到该用户' })
  const [links]: any = await db.query(
    'SELECT name, url, icon FROM user_links WHERE user_id = ? AND is_public = 1 ORDER BY sort ASC, id ASC',
    [u.id]
  )
  return {
    profile: { id: u.id, nickname: u.nickname, avatar: u.avatar || qqAvatarUrl(u.qq) },
    links,
    hasPublicLinks: links.length > 0
  }
})
