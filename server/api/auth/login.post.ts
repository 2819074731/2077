import { withDefaultAvatar } from '../../utils/user'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'login', 10, 60_000)
  const body = await readBody(event)
  const account = String(body?.account ?? body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password || '')
  if (!account) throw createError({ statusCode: 400, statusMessage: '请输入邮箱或用户名' })
  if (password.length > PASSWORD_MAX) throw createError({ statusCode: 400, statusMessage: '账号或密码不正确' })
  await rateLimit(event, `login-account:${hashToken(account).slice(0, 24)}`, 20, 10 * 60_000)
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT id, email, username, nickname, avatar, qq, slug, password_hash, is_admin FROM users WHERE email = ? OR username = ? LIMIT 1',
    [account, account]
  )
  const u = rows[0]
  if (!u) {
    await dummyVerify(password)
    throw createError({ statusCode: 401, statusMessage: '账号或密码不正确' })
  }
  if (!(await verifyPassword(password, u.password_hash))) {
    throw createError({ statusCode: 401, statusMessage: '账号或密码不正确' })
  }
  await createSession(event, u.id)
  return { user: withDefaultAvatar({ id: u.id, email: u.email, username: u.username, nickname: u.nickname, avatar: u.avatar, qq: u.qq, slug: u.slug, is_admin: u.is_admin }) }
})
