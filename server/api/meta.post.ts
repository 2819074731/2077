import { createHash } from 'node:crypto'
import { fetchSiteMeta, normalizeSiteUrl } from '../utils/site'
import { rateLimit } from '../utils/rateLimit'

const TTL_MS = 1000 * 60 * 60 * 24 * 7

function hashUrl(url: string): string {
  return createHash('sha1').update(url).digest('hex')
}

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'meta', 120, 60 * 1000)
  const body = await readBody(event)
  const raw = String(body?.url || '').trim()
  if (!raw) throw createError({ statusCode: 400, statusMessage: '请输入网址' })
  const u = normalizeSiteUrl(raw)
  u.hash = ''
  const key = u.toString()
  const hash = hashUrl(key)

  const db = useDb()
  const [cached]: any = await db.query(
    'SELECT url, host, title, description, keywords, icon, fetched_at FROM meta_cache WHERE url_hash = ? LIMIT 1',
    [hash]
  )
  const row = cached[0]
  if (row && Date.now() - new Date(row.fetched_at).getTime() < TTL_MS) {
    return {
      meta: {
        url: row.url,
        host: row.host,
        title: row.title,
        description: row.description || '',
        keywords: row.keywords || '',
        icon: row.icon || ''
      },
      cached: true
    }
  }

  const meta = await fetchSiteMeta(key)
  if (!meta.title && !meta.description && !meta.icon) {
    throw createError({ statusCode: 502, statusMessage: '无法抓取该站点信息，请手动填写' })
  }

  await db.execute(
    `INSERT INTO meta_cache (url_hash, url, host, title, description, keywords, icon, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE url = VALUES(url), host = VALUES(host), title = VALUES(title),
       description = VALUES(description), keywords = VALUES(keywords), icon = VALUES(icon), fetched_at = NOW()`,
    [hash, meta.url, meta.host, meta.title, meta.description, meta.keywords, meta.icon]
  )

  return { meta, cached: false }
})
