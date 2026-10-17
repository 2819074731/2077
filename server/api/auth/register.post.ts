import { normalizeQq, withDefaultAvatar } from '../../utils/user'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body?.email || '').trim().toLowerCase()
  const username = String(body?.username || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const qq = normalizeQq(body?.qq)
  const nickname = String(body?.nickname || '').trim() || username || email.split('@')[0]

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: '邮箱格式不正确' })
  if (username && !/^[a-z0-9_-]{3,60}$/.test(username)) throw createError({ statusCode: 400, statusMessage: '用户名需 3-60 位字母、数字、下划线或短横线' })
  if (password.length < 6) throw createError({ statusCode: 400, statusMessage: '密码至少 6 位' })
  if (!qq) throw createError({ statusCode: 400, statusMessage: '请填写正确的 QQ 号' })

  const db = useDb()
  const [exists]: any = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
  if (exists.length) throw createError({ statusCode: 409, statusMessage: '该邮箱已注册' })
  if (username) {
    const [un]: any = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username])
    if (un.length) throw createError({ statusCode: 409, statusMessage: '该用户名已被占用' })
  }
  const [qqExists]: any = await db.query('SELECT id FROM users WHERE qq = ? LIMIT 1', [qq])
  if (qqExists.length) throw createError({ statusCode: 409, statusMessage: '该 QQ 号已绑定其他账号' })

  let slug = slugify(nickname)
  for (let i = 0; i < 5; i++) {
    const [s]: any = await db.query('SELECT id FROM users WHERE slug = ? LIMIT 1', [slug])
    if (!s.length) break
    slug = slugify(nickname) + '-' + Math.random().toString(36).slice(2, 6)
  }

  let r: any
  try {
    ;[r] = await db.execute(
      'INSERT INTO users (email, username, nickname, qq, slug, password_hash, config_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, username || null, nickname, qq, slug, hashPassword(password), JSON.stringify({ groups: [], version: 0 })]
    )
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate entry')) {
      throw createError({ statusCode: 409, statusMessage: '该邮箱或 QQ 号已注册' })
    }
    throw err
  }
  await createSession(event, r.insertId)
  return {
    user: withDefaultAvatar({
      id: r.insertId,
      email,
      username: username || null,
      nickname,
      qq,
      avatar: null,
      slug,
      links: []
    })
  }
})
