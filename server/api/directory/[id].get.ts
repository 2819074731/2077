import { parseDirectoryId } from '../../utils/directory'

const CATEGORY_TTL = 5 * 60 * 1000
let categoryCache: { at: number; rows: any[] } | null = null

async function categorySnapshot() {
  if (categoryCache && Date.now() - categoryCache.at < CATEGORY_TTL) return categoryCache.rows
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries
     WHERE status = 'published' AND health_hidden = 0
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  categoryCache = { at: Date.now(), rows }
  return rows
}

export default defineEventHandler(async (event) => {
  const id = parseDirectoryId(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 404, statusMessage: '页面不存在' })
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, name, url, icon, category, province, city, school_level, school_type, supervisor, title, description, keywords, content, featured, health_hidden, created_at, updated_at
     FROM directory_entries WHERE id = ? AND status = 'published' AND detail_enabled = 1 LIMIT 1`,
    [id]
  )
  const item = rows[0]
  if (!item) throw createError({ statusCode: 404, statusMessage: '页面不存在' })

  const [related]: any = await db.query(
    `SELECT id, name, url, icon, category, province, school_level, description, detail_enabled
     FROM directory_entries
     WHERE status = 'published' AND health_hidden = 0 AND category = ? AND id <> ?
     ORDER BY (province = ? AND province <> '') DESC,
       (school_level = ? AND school_level <> '') DESC,
       featured DESC, ABS(id - ?) ASC
     LIMIT 6`,
    [item.category, id, item.province || '', item.school_level || '', id]
  )
  if (related.length < 6) {
    const seen = new Set<number>([id, ...related.map((r: any) => r.id)])
    const [fallback]: any = await db.query(
      `SELECT id, name, url, icon, category, province, school_level, description, detail_enabled
       FROM directory_entries WHERE status = 'published' AND health_hidden = 0
       ORDER BY featured DESC, id DESC LIMIT 30`
    )
    for (const r of fallback) {
      if (related.length >= 6) break
      if (seen.has(r.id)) continue
      seen.add(r.id)
      related.push(r)
    }
  }

  const categories = await categorySnapshot()
  const [latest]: any = await db.query(
    `SELECT id, name, url, icon, category, detail_enabled
     FROM directory_entries WHERE status = 'published' AND health_hidden = 0 AND id <> ? ORDER BY id DESC LIMIT 6`,
    [id]
  )
  const [prevRows]: any = await db.query(
    `SELECT id, name FROM directory_entries
     WHERE status = 'published' AND health_hidden = 0 AND detail_enabled = 1 AND category = ? AND id < ?
     ORDER BY id DESC LIMIT 1`,
    [item.category, id]
  )
  const [nextRows]: any = await db.query(
    `SELECT id, name FROM directory_entries
     WHERE status = 'published' AND health_hidden = 0 AND detail_enabled = 1 AND category = ? AND id > ?
     ORDER BY id ASC LIMIT 1`,
    [item.category, id]
  )

  return { item, related, latest, prev: prevRows[0] || null, next: nextRows[0] || null, categories }
})
