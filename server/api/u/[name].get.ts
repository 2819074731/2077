import { qqAvatarUrl } from '../../utils/user'

export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'name') || '').trim()
  if (!slug) throw createError({ statusCode: 400, statusMessage: '无效用户' })
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT id, nickname, avatar, qq, slug FROM users WHERE slug = ? LIMIT 1',
    [slug]
  )
  const u = rows[0]
  if (!u) throw createError({ statusCode: 404, statusMessage: '未找到该用户' })
  const [links]: any = await db.query(
    'SELECT name, url, icon FROM user_links WHERE user_id = ? AND is_public = 1 ORDER BY sort ASC, id ASC',
    [u.id]
  )
  return { profile: { nickname: u.nickname, avatar: u.avatar || qqAvatarUrl(u.qq), slug: u.slug }, links }
})
