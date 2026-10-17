export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = String(body?.email || '').trim().toLowerCase()
  const username = String(body?.username || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const nickname = String(body?.nickname || '').trim() || username || email.split('@')[0]

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: '邮箱格式不正确' })
  if (username && !/^[a-z0-9_-]{3,60}$/.test(username)) throw createError({ statusCode: 400, statusMessage: '用户名需 3-60 位字母、数字、下划线或短横线' })
  if (password.length < 6) throw createError({ statusCode: 400, statusMessage: '密码至少 6 位' })

  const db = useDb()
  const [exists]: any = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
  if (exists.length) throw createError({ statusCode: 409, statusMessage: '该邮箱已注册' })
  if (username) {
    const [un]: any = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username])
    if (un.length) throw createError({ statusCode: 409, statusMessage: '该用户名已被占用' })
  }

  let slug = slugify(nickname)
  for (let i = 0; i < 5; i++) {
    const [s]: any = await db.query('SELECT id FROM users WHERE slug = ? LIMIT 1', [slug])
    if (!s.length) break
    slug = slugify(nickname) + '-' + Math.random().toString(36).slice(2, 6)
  }

  const [r]: any = await db.execute(
    'INSERT INTO users (email, username, nickname, slug, password_hash, config_json) VALUES (?, ?, ?, ?, ?, ?)',
    [email, username || null, nickname, slug, hashPassword(password), JSON.stringify({ groups: [], version: 0 })]
  )
  await createSession(event, r.insertId)
  return { user: { id: r.insertId, email, username: username || null, nickname, slug, links: [] } }
})
