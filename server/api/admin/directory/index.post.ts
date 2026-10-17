import { sanitizeDirectoryEntry, iconForUrl } from '../../../utils/directory'

function isDup(e: any): boolean {
  return e?.code === 'ER_DUP_ENTRY' || String(e?.message || '').includes('Duplicate entry')
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const action = String(body?.action || 'save')
  const db = useDb()

  if (action === 'delete') {
    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: '缺少 ID' })
    await db.execute('DELETE FROM directory_entries WHERE id = ?', [id])
    return { ok: true }
  }

  if (action === 'status') {
    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: '缺少 ID' })
    const status = String(body?.status) === 'hidden' ? 'hidden' : 'published'
    await db.execute('UPDATE directory_entries SET status = ? WHERE id = ?', [status, id])
    return { ok: true, status }
  }

  if (action === 'bulk-create') {
    const list = Array.isArray(body?.items) ? body.items.slice(0, 100) : []
    let created = 0
    let skipped = 0
    for (const raw of list) {
      try {
        const e = sanitizeDirectoryEntry({
          name: raw?.name,
          url: raw?.url,
          icon: raw?.icon || iconForUrl(String(raw?.url || '')),
          category: body?.category || raw?.category || '其他',
          description: raw?.description || ''
        })
        await db.execute(
          `INSERT INTO directory_entries (name, url, icon, category, description, status, detail_enabled)
           VALUES (?, ?, ?, ?, ?, 'published', 1)`,
          [e.name, e.url, e.icon, e.category, e.description]
        )
        created++
      } catch {
        skipped++
      }
    }
    return { ok: true, created, skipped }
  }

  const e = sanitizeDirectoryEntry(body?.entry || body)
  const id = Number(body?.id || body?.entry?.id || 0)
  try {
    if (id) {
      await db.execute(
        `UPDATE directory_entries SET name = ?, url = ?, icon = ?, category = ?, title = ?,
           description = ?, keywords = ?, content = ?, featured = ?, sort = ?, status = ?, detail_enabled = ?
         WHERE id = ?`,
        [e.name, e.url, e.icon, e.category, e.title, e.description, e.keywords, e.content, e.featured, e.sort, e.status, e.detail_enabled, id]
      )
      return { ok: true, id }
    }
    const [r]: any = await db.execute(
      `INSERT INTO directory_entries (name, url, icon, category, title, description, keywords, content, featured, sort, status, detail_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.name, e.url, e.icon, e.category, e.title, e.description, e.keywords, e.content, e.featured, e.sort, e.status, e.detail_enabled]
    )
    return { ok: true, id: Number(r.insertId) }
  } catch (err: any) {
    if (isDup(err)) throw createError({ statusCode: 409, statusMessage: '目录中已存在该网址' })
    throw err
  }
})
