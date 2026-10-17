export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT id, email, nickname, slug, password_hash FROM users WHERE email = ? LIMIT 1',
    [email]
  )
  const u = rows[0]
  if (!u || !verifyPassword(password, u.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: '邮箱或密码不正确' })
  }
  await createSession(event, u.id)
  return { user: { id: u.id, email: u.email, nickname: u.nickname, slug: u.slug } }
})
