import { normalizeSiteUrl } from '../utils/site'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const name = String(body?.name || '').trim().slice(0, 80)
  const urlRaw = String(body?.url || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: '请填写站点名称' })
  const u = normalizeSiteUrl(urlRaw)

  const user = await getSessionUser(event)
  const db = useDb()
  const target = String(body?.target || '') === 'directory' ? 'directory' : 'nav'

  const [dup]: any = await db.query('SELECT id FROM submissions WHERE url = ? LIMIT 1', [u.toString()])
  if (dup.length) throw createError({ statusCode: 409, statusMessage: '该站点已提交过' })

  await db.execute(
    'INSERT INTO submissions (user_id, name, url, icon, title, description, keywords, grp, target, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [
      user?.id || null,
      name,
      u.toString().slice(0, 500),
      String(body?.icon || '').slice(0, 500),
      String(body?.title || '').slice(0, 200),
      String(body?.description || '').slice(0, 500),
      String(body?.keywords || '').slice(0, 300),
      String(body?.group || '').slice(0, 60),
      target,
      'pending'
    ]
  )
  return { ok: true }
})
