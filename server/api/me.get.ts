export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '未登录' })
  const db = useDb()
  const [links]: any = await db.query(
    'SELECT id, name, url, icon, sort, is_public AS `public` FROM user_links WHERE user_id = ? ORDER BY sort ASC, id ASC',
    [user.id]
  )
  return { user: { ...user, links: links.map((l: any) => ({ ...l, public: Number(l.public) === 1 })) } }
})
