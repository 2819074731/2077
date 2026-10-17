import { fetchSiteMeta } from '../../../utils/site'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const limit = Math.max(1, Math.min(12, Number(body?.limit) || 6))
  const db = useDb()

  const [rows]: any = await db.query(
    `SELECT id, name, url, title, description, keywords, icon
     FROM directory_entries
     WHERE status = 'published'
       AND (tdk_checked_at IS NULL OR tdk_checked_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
       AND (COALESCE(title, '') = '' OR COALESCE(description, '') = '')
     ORDER BY (COALESCE(description, '') = '') DESC, id ASC
     LIMIT ${limit}`
  )

  let updated = 0
  const failed: number[] = []
  const run = async (row: any) => {
    try {
      const meta = await fetchSiteMeta(row.url)
      if (!meta.title && !meta.description) {
        await db.execute('UPDATE directory_entries SET tdk_checked_at = NOW() WHERE id = ?', [row.id])
        failed.push(Number(row.id))
        return
      }
      const title = row.title || meta.title || row.name
      const description = row.description || meta.description || ''
      const keywords = row.keywords || meta.keywords || ''
      const icon = row.icon || (/^https?:\/\//i.test(meta.icon) ? meta.icon : '')
      await db.execute(
        'UPDATE directory_entries SET title = ?, description = ?, keywords = ?, icon = ?, tdk_checked_at = NOW() WHERE id = ?',
        [String(title).slice(0, 200), String(description).slice(0, 500), String(keywords).slice(0, 300), String(icon).slice(0, 500), row.id]
      )
      updated++
    } catch {
      failed.push(Number(row.id))
    }
  }
  for (let i = 0; i < rows.length; i += 3) {
    await Promise.all(rows.slice(i, i + 3).map(run))
  }

  const [[remain]]: any = await db.query(
    "SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published' AND tdk_checked_at IS NULL AND (COALESCE(title, '') = '' OR COALESCE(description, '') = '')"
  )
  const [[missing]]: any = await db.query(
    "SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published' AND (COALESCE(title, '') = '' OR COALESCE(description, '') = '')"
  )
  return { ok: true, processed: rows.length, updated, failed, remaining: Number(remain?.n || 0), missing: Number(missing?.n || 0) }
})
