export default defineEventHandler(async (event) => {
  await rateLimit(event, 'password-change', 10, 10 * 60_000)
  const me = await getSessionUser(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: '未登录' })

  const body = await readBody(event)
  const current = String(body?.currentPassword || '')
  const next = String(body?.newPassword || '')
  if (!current) throw createError({ statusCode: 400, statusMessage: '请输入当前密码' })
  const pwProblem = passwordProblem(next)
  if (pwProblem) throw createError({ statusCode: 400, statusMessage: pwProblem })
  if (next === current) throw createError({ statusCode: 400, statusMessage: '新密码不能与当前密码相同' })

  const db = useDb()
  const [rows]: any = await db.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [me.id])
  const stored = rows[0]?.password_hash
  if (!stored || !(await verifyPassword(current, stored))) {
    throw createError({ statusCode: 400, statusMessage: '当前密码不正确' })
  }

  await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(next), me.id])
  const removed = await revokeOtherSessions(event, me.id)
  return { ok: true, removed }
})
