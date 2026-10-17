import { parseDirectoryId } from '../../utils/directory'

export default defineEventHandler(async (event) => {
  const id = parseDirectoryId(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 404, statusMessage: '页面不存在' })
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, name, url, icon, category, title, description, keywords, content, featured, created_at, updated_at
     FROM directory_entries WHERE id = ? AND status = 'published' AND detail_enabled = 1 LIMIT 1`,
    [id]
  )
  const item = rows[0]
  if (!item) throw createError({ statusCode: 404, statusMessage: '页面不存在' })

  const [related]: any = await db.query(
    `SELECT id, name, url, icon, category, description, detail_enabled
     FROM directory_entries WHERE status = 'published' AND category = ? AND id <> ?
     ORDER BY ABS(id - ?) ASC, id DESC LIMIT 6`,
    [item.category, id, id]
  )
  if (related.length < 6) {
    const seen = new Set<number>([id, ...related.map((r: any) => r.id)])
    const [fallback]: any = await db.query(
      `SELECT id, name, url, icon, category, description, detail_enabled
       FROM directory_entries WHERE status = 'published'
       ORDER BY id DESC LIMIT 30`
    )
    for (const r of fallback) {
      if (related.length >= 6) break
      if (seen.has(r.id)) continue
      seen.add(r.id)
      related.push(r)
    }
  }

  const [categories]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries WHERE status = 'published'
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  const [latest]: any = await db.query(
    `SELECT id, name, url, icon, category, detail_enabled
     FROM directory_entries WHERE status = 'published' AND id <> ? ORDER BY id DESC LIMIT 6`,
    [id]
  )
  const [prevRows]: any = await db.query(
    `SELECT id, name FROM directory_entries
     WHERE status = 'published' AND detail_enabled = 1 AND category = ? AND id < ?
     ORDER BY id DESC LIMIT 1`,
    [item.category, id]
  )
  const [nextRows]: any = await db.query(
    `SELECT id, name FROM directory_entries
     WHERE status = 'published' AND detail_enabled = 1 AND category = ? AND id > ?
     ORDER BY id ASC LIMIT 1`,
    [item.category, id]
  )

  return { item, related, latest, prev: prevRows[0] || null, next: nextRows[0] || null, categories }
})
