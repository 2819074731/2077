export default defineEventHandler(async (event) => {
  await rateLimit(event, 'search-result', 120, 60_000)
  const body = await readBody(event).catch(() => null)
  const term = String(body?.term ?? '').trim()
  if (!term || term.length > 120 || /^https?:\/\//i.test(term)) return { ok: true }
  if (String(body?.engine ?? 'github') !== 'github') return { ok: true }

  const results = Number(body?.results)
  if (!Number.isInteger(results) || results < 0 || results > 10_000_000) return { ok: true }

  const db = useDb()
  await db.execute(
    `UPDATE search_events SET results = ?
     WHERE engine = 'github' AND term = ? AND results IS NULL
       AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
     ORDER BY id DESC LIMIT 1`,
    [results, term]
  )
  return { ok: true }
})
