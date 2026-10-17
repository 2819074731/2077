import { clientIp } from '../utils/weather'

interface Body { url?: string; name?: string }

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const raw = String(body?.url || '').trim()
  if (!/^https?:\/\//.test(raw)) return { ok: false }
  const url = raw.slice(0, 500)
  const name = String(body?.name || '').trim().slice(0, 80)
  const user = await getSessionUser(event)
  const ip = clientIp(event).slice(0, 64)

  const db = useDb()
  try {
    await db.execute('INSERT INTO link_clicks (url, name, user_id, ip) VALUES (?, ?, ?, ?)', [
      url, name, user?.id ?? null, ip
    ])
    await db.execute(
      `INSERT INTO link_click_agg (url, name, hits, last_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE hits = hits + 1, last_at = NOW(),
         name = IF(VALUES(name) <> '', VALUES(name), name)`,
      [url, name]
    )
  } catch {
    return { ok: false }
  }
  return { ok: true }
})
