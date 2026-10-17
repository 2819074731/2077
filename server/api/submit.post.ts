import { normalizeSiteUrl } from '../utils/site'
import { cleanText, safeIcon } from '../utils/sanitize'
import { rateLimit } from '../utils/rateLimit'
import { DEFAULT_GROUPS, urlKey } from '#shared/nav'
import { DIRECTORY_CATEGORIES } from '#shared/directory'

const NAV_GROUPS = [...DEFAULT_GROUPS.map(g => g.name), '其他']

export default defineEventHandler(async (event) => {
  const length = Number(getRequestHeader(event, 'content-length') || 0)
  if (length > 32 * 1024) {
    throw createError({ statusCode: 413, statusMessage: '提交内容过大' })
  }
  rateLimit(event, 'submit', 10, 10 * 60 * 1000)

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '提交内容格式不正确' })
  }
  if (String(body?._trap || '').trim()) return { ok: true }

  const name = cleanText(body?.name, 80)
  if (!name) throw createError({ statusCode: 400, statusMessage: '请填写站点名称' })
  const u = normalizeSiteUrl(String(body?.url || ''))
  const target = String(body?.target || '') === 'directory' ? 'directory' : 'nav'
  const allowed: readonly string[] = target === 'directory' ? DIRECTORY_CATEGORIES : NAV_GROUPS
  const groupRaw = cleanText(body?.group, 60)
  const group = allowed.includes(groupRaw) ? groupRaw : ''

  const user = await getSessionUser(event)
  const db = useDb()
  const key = urlKey(u.toString()).toLowerCase()

  const [dup]: any = await db.query(
    'SELECT id FROM submissions WHERE TRIM(TRAILING \'/\' FROM LOWER(url)) = ? LIMIT 1',
    [key]
  )
  if (dup.length) throw createError({ statusCode: 409, statusMessage: '该站点已提交过' })

  await db.execute(
    'INSERT INTO submissions (user_id, name, url, icon, title, description, keywords, grp, target, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [
      user?.id || null,
      name,
      u.toString().slice(0, 500),
      safeIcon(body?.icon) || `/api/icon?url=${encodeURIComponent(u.hostname)}`,
      cleanText(body?.title, 200),
      cleanText(body?.description, 500),
      cleanText(body?.keywords, 300),
      group,
      target,
      'pending'
    ]
  )
  return { ok: true }
})
