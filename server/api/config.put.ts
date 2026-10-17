export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '未登录' })
  const body = await readBody(event)
  const groups = Array.isArray(body?.groups) ? body.groups : []
  const freq = body?.freq && typeof body.freq === 'object' ? body.freq : {}
  const db = useDb()
  const cfg = { groups, freq, version: Date.now() }
  await db.execute('UPDATE users SET config_json = ? WHERE id = ?', [JSON.stringify(cfg), user.id])
  return { ok: true, version: cfg.version }
})
