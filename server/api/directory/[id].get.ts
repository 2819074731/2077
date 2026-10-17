import { parseDirectoryId } from '../../utils/directory'

export default defineEventHandler(async (event) => {
  const id = parseDirectoryId(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 404, statusMessage: '页面不存在' })
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, name, url, icon, category, title, description, keywords, content, featured, created_at
     FROM directory_entries WHERE id = ? AND status = 'published' LIMIT 1`,
    [id]
  )
  const item = rows[0]
  if (!item) throw createError({ statusCode: 404, statusMessage: '页面不存在' })

  const [related]: any = await db.query(
    `SELECT id, name, url, icon, category, description
     FROM directory_entries WHERE status = 'published' AND category = ? AND id <> ?
     ORDER BY featured DESC, sort ASC, id DESC LIMIT 6`,
    [item.category, id]
  )
  if (!related.length) {
    const [latest]: any = await db.query(
      `SELECT id, name, url, icon, category, description
       FROM directory_entries WHERE status = 'published' AND id <> ?
       ORDER BY id DESC LIMIT 6`,
      [id]
    )
    return { item, related: latest }
  }
  return { item, related }
})
