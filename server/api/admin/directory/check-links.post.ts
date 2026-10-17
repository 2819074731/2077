import { safeFetch } from '../../../utils/safeUrl'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const limit = Math.max(1, Math.min(20, Number(body?.limit) || 8))
  const db = useDb()

  const [rows]: any = await db.query(
    `SELECT id, url FROM directory_entries
     WHERE status = 'published' AND (checked_at IS NULL OR checked_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
     ORDER BY checked_at IS NULL DESC, id ASC LIMIT ${limit}`
  )

  let ok = 0
  let broken = 0
  const run = async (row: any) => {
    const hit = await safeFetch(row.url, {
      timeout: 8000,
      maxRedirects: 4,
      headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }
    }).catch(() => null)
    const status = hit?.res.status || 0
    const finalUrl = String(hit?.finalUrl || '').slice(0, 500)
    if (hit?.res.body) await hit.res.body.cancel().catch(() => {})
    if (status > 0 && (status < 400 || [401, 403, 429].includes(status))) ok++
    else broken++
    await db.execute(
      'UPDATE directory_entries SET http_status = ?, final_url = ?, checked_at = NOW() WHERE id = ?',
      [status, finalUrl, row.id]
    )
  }
  for (let i = 0; i < rows.length; i += 4) {
    await Promise.all(rows.slice(i, i + 4).map(run))
  }

  const [[remain]]: any = await db.query(
    "SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published' AND (checked_at IS NULL OR checked_at < DATE_SUB(NOW(), INTERVAL 7 DAY))"
  )
  return { ok: true, checked: rows.length, healthy: ok, broken, remaining: Number(remain?.n || 0) }
})
