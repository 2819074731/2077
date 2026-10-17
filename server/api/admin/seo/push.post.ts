import { pushSearchUrls } from '../../../utils/searchPush'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const scope = ['all', 'category', 'urls'].includes(String(body?.scope))
    ? String(body.scope) as 'all' | 'category' | 'urls'
    : 'all'
  const category = String(body?.category || '').trim().slice(0, 60)
  const db = useDb()
  const urls: string[] = ['/', '/site', '/sitemap', '/submit']

  if (scope === 'urls') {
    const list = Array.isArray(body?.urls) ? body.urls.slice(0, 1000) : []
    urls.length = 0
    urls.push(...list.map((u: unknown) => String(u || '')))
  } else {
    const where = scope === 'category' && category ? ' AND category = ?' : ''
    const [rows]: any = await db.query(
      `SELECT id FROM directory_entries WHERE status = 'published' AND detail_enabled = 1${where} ORDER BY id ASC`,
      category ? [category] : []
    )
    for (const row of rows) urls.push(`/site/${Number(row.id)}.html`)
    const [cats]: any = await db.query(
      `SELECT category FROM directory_entries WHERE status = 'published'${where} GROUP BY category`,
      category ? [category] : []
    )
    for (const row of cats) {
      if (row.category) urls.push(`/site?category=${encodeURIComponent(String(row.category))}`)
    }
  }

  if (!urls.length) throw createError({ statusCode: 400, statusMessage: '没有可推送的 URL' })
  const result = await pushSearchUrls(urls)
  return { ok: true, scope, category, ...result }
})
