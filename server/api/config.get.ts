export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '未登录' })
  const db = useDb()
  const [rows]: any = await db.query('SELECT config_json FROM users WHERE id = ? LIMIT 1', [user.id])
  let cfg: any = {}
  try { cfg = JSON.parse(rows[0]?.config_json || '{}') } catch {}
  return {
    groups: cfg.groups || [],
    freq: cfg.freq || {},
    freqAt: cfg.freqAt || {},
    freqMeta: { pin: cfg.freqMeta?.pin || [], hide: cfg.freqMeta?.hide || [] },
    bookmarks: Array.isArray(cfg.bookmarks) ? cfg.bookmarks : [],
    version: cfg.version || 0
  }
})
