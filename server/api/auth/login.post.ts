export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const account = String(body?.account ?? body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password || '')
  if (!account) throw createError({ statusCode: 400, statusMessage: '请输入邮箱或用户名' })
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT id, email, username, nickname, avatar, slug, password_hash, is_admin FROM users WHERE email = ? OR username = ? LIMIT 1',
    [account, account]
  )
  const u = rows[0]
  if (!u || !verifyPassword(password, u.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: '账号或密码不正确' })
  }
  await createSession(event, u.id)
  return { user: { id: u.id, email: u.email, username: u.username, nickname: u.nickname, avatar: u.avatar, slug: u.slug, is_admin: u.is_admin } }
})
