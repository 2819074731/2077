export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '未登录' })
  const body = await readBody(event)
  const input = Array.isArray(body?.links) ? body.links : []
  const db = useDb()

  const links = input
    .map((l: any, i: number) => ({
      name: String(l?.name || '').trim().slice(0, 60),
      url: String(l?.url || '').trim().slice(0, 500),
      icon: String(l?.icon || '').trim().slice(0, 500),
      sort: i,
      is_public: l?.public === false ? 0 : 1
    }))
    .filter((l: any) => l.name && /^https?:\/\//.test(l.url))
    .slice(0, 50)

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute('DELETE FROM user_links WHERE user_id = ?', [user.id])
    for (const l of links) {
      await conn.execute(
        'INSERT INTO user_links (user_id, name, url, icon, sort, is_public) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, l.name, l.url, l.icon, l.sort, l.is_public]
      )
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }

  const [rows]: any = await db.query(
    'SELECT id, name, url, icon, sort, is_public AS `public` FROM user_links WHERE user_id = ? ORDER BY sort ASC, id ASC',
    [user.id]
  )
  return { links: rows }
})
