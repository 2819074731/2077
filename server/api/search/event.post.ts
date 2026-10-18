export default defineEventHandler(async (event) => {
  await rateLimit(event, 'search-event', 60, 60_000)
  const body = await readBody(event).catch(() => null)
  const rawTerm = String(body?.term ?? '').trim()
  if (!rawTerm) return { ok: true }
  if (rawTerm.length > 120 || /^https?:\/\//i.test(rawTerm)) return { ok: true }
  const engine = String(body?.engine ?? '').trim().slice(0, 32) || 'unknown'
  const kind = body?.kind === 'hot' ? 'hot' : 'input'
  const db = useDb()
  await db.execute(
    'INSERT INTO search_events (engine, term, kind) VALUES (?, ?, ?)',
    [engine, rawTerm, kind]
  )
  return { ok: true }
})
