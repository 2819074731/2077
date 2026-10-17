import { randomBytes } from 'node:crypto'
import { normalizeSiteUrl } from '../utils/site'
import { cleanText, safeIcon } from '../utils/sanitize'
import { rateLimit } from '../utils/rateLimit'
import { urlKey } from '#shared/nav'
import { getSiteCategories } from '../utils/categories'
import { notifyAdmin } from '../utils/notify'

export default defineEventHandler(async (event) => {
  const length = Number(getRequestHeader(event, 'content-length') || 0)
  if (length > 32 * 1024) {
    throw createError({ statusCode: 413, statusMessage: '提交内容过大' })
  }
  await rateLimit(event, 'submit', 10, 10 * 60 * 1000)

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '提交内容格式不正确' })
  }
  if (String(body?._trap || '').trim()) return { ok: true }

  const name = cleanText(body?.name, 80)
  if (!name) throw createError({ statusCode: 400, statusMessage: '请填写站点名称' })
  const u = normalizeSiteUrl(String(body?.url || ''))
  const target = String(body?.target || '') === 'directory' ? 'directory' : 'nav'
  const groupRaw = cleanText(body?.group, 60)
  const categories = await getSiteCategories()
  const group = categories.includes(groupRaw) ? groupRaw : ''

  const user = await getSessionUser(event)
  const db = useDb()
  const key = urlKey(u.toString()).toLowerCase()

  const [dup]: any = await db.query(
    'SELECT id FROM submissions WHERE url_key = ? LIMIT 1',
    [key]
  )
  if (dup.length) throw createError({ statusCode: 409, statusMessage: '该站点已提交过' })

  const [inDirectory]: any = await db.query(
    'SELECT id FROM directory_entries WHERE url_key = ? LIMIT 1',
    [key]
  )
  if (inDirectory.length) {
    throw createError({ statusCode: 409, statusMessage: '该站点已收录在分类目录' })
  }

  const accessToken = randomBytes(24).toString('hex')
  const [result]: any = await db.execute(
    'INSERT INTO submissions (user_id, name, url, icon, title, description, keywords, grp, target, status, access_token) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
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
      'pending',
      accessToken
    ]
  )
  const id = Number(result?.insertId || 0)
  void notifyAdmin(`新收录提交：${name}`, { id, category: group || '未分类', target })
  return { ok: true, id, token: accessToken }
})
