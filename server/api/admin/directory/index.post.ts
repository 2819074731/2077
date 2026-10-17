import { sanitizeDirectoryEntry, iconForUrl } from '../../../utils/directory'
import { notifySearchUrls } from '../../../utils/searchPush'

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
    const [rows]: any = await db.query('SELECT category, detail_enabled FROM directory_entries WHERE id = ? LIMIT 1', [id])
    await db.execute('UPDATE directory_entries SET status = ? WHERE id = ?', [status, id])
    if (status === 'published' && rows[0]?.detail_enabled) {
      notifySearchUrls([`/site/${id}.html`, `/site?category=${encodeURIComponent(String(rows[0].category || '其他'))}`])
    }
    return { ok: true, status }
  }

  if (action === 'bulk') {
    const ids = Array.isArray(body?.ids)
      ? [...new Set(body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))]
      : []
    const op = String(body?.op || '')
    if (!ids.length) throw createError({ statusCode: 400, statusMessage: '请选择目录站点' })
    if (ids.length > 200) throw createError({ statusCode: 400, statusMessage: '单次最多处理 200 个站点' })
    if (op !== 'publish' && op !== 'hide') throw createError({ statusCode: 400, statusMessage: '未知批量操作' })

    const [rows]: any = await db.query(
      `SELECT id, category, detail_enabled FROM directory_entries WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    )
    const byId = new Map<number, any>(rows.map((row: any) => [Number(row.id), row]))
    const status = op === 'publish' ? 'published' : 'hidden'
    let updated = 0
    let skipped = 0
    let errors = 0
    const pushed: string[] = []

    for (const id of ids) {
      const row = byId.get(id)
      if (!row) {
        skipped++
        continue
      }
      try {
        await db.execute('UPDATE directory_entries SET status = ? WHERE id = ?', [status, id])
        updated++
        if (status === 'published' && row.detail_enabled) {
          pushed.push(`/site/${id}.html`, `/site?category=${encodeURIComponent(String(row.category || '其他'))}`)
        }
      } catch {
        errors++
      }
    }
    if (pushed.length) notifySearchUrls(pushed)

    return { ok: true, updated, skipped, errors }
  }

  if (action === 'bulk-create') {
    const list = Array.isArray(body?.items) ? body.items.slice(0, 100) : []
    let created = 0
    let skipped = 0
    const pushed: string[] = []
    for (const raw of list) {
      try {
        const e = sanitizeDirectoryEntry({
          name: raw?.name,
          url: raw?.url,
          icon: raw?.icon || iconForUrl(String(raw?.url || '')),
          category: body?.category || raw?.category || '其他',
          description: raw?.description || ''
        })
        const [r]: any = await db.execute(
          `INSERT INTO directory_entries (name, url, icon, category, description, status, detail_enabled)
           VALUES (?, ?, ?, ?, ?, 'published', 1)`,
          [e.name, e.url, e.icon, e.category, e.description]
        )
        created++
        pushed.push(`/site/${Number(r.insertId)}.html`, `/site?category=${encodeURIComponent(e.category)}`)
      } catch {
        skipped++
      }
    }
    if (pushed.length) notifySearchUrls(pushed)
    return { ok: true, created, skipped }
  }

  const e = sanitizeDirectoryEntry(body?.entry || body)
  const id = Number(body?.id || body?.entry?.id || 0)
  try {
    if (id) {
      const [oldRows]: any = await db.query('SELECT category FROM directory_entries WHERE id = ? LIMIT 1', [id])
      const oldCategory = String(oldRows[0]?.category || '')
      await db.execute(
        `UPDATE directory_entries SET name = ?, url = ?, icon = ?, category = ?, title = ?,
           description = ?, keywords = ?, content = ?, featured = ?, sort = ?, status = ?, detail_enabled = ?
         WHERE id = ?`,
        [e.name, e.url, e.icon, e.category, e.title, e.description, e.keywords, e.content, e.featured, e.sort, e.status, e.detail_enabled, id]
      )
      if (e.status === 'published' && e.detail_enabled) {
        const urls = [`/site/${id}.html`, `/site?category=${encodeURIComponent(e.category)}`]
        if (oldCategory && oldCategory !== e.category) urls.push(`/site?category=${encodeURIComponent(oldCategory)}`)
        notifySearchUrls(urls)
      }
      return { ok: true, id }
    }
    const [r]: any = await db.execute(
      `INSERT INTO directory_entries (name, url, icon, category, title, description, keywords, content, featured, sort, status, detail_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.name, e.url, e.icon, e.category, e.title, e.description, e.keywords, e.content, e.featured, e.sort, e.status, e.detail_enabled]
    )
    const newId = Number(r.insertId)
    if (e.status === 'published' && e.detail_enabled) {
      notifySearchUrls([`/site/${newId}.html`, `/site?category=${encodeURIComponent(e.category)}`])
    }
    return { ok: true, id: newId }
  } catch (err: any) {
    if (isDup(err)) throw createError({ statusCode: 409, statusMessage: '目录中已存在该网址' })
    throw err
  }
})
