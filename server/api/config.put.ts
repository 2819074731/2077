function cleanKeys(input: unknown): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(input) ? input : []) {
    const key = String(raw || '').trim().slice(0, 500)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
    if (out.length >= 200) break
  }
  return out
}

function cleanBookmarks(input: unknown): any[] {
  const out: any[] = []
  const seen = new Set<string>()
  if (!Array.isArray(input)) return out
  for (const raw of input.slice(0, 500)) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as any
    let url = String(item.url || '').trim().slice(0, 500)
    if (!/^https?:\/\//i.test(url)) continue
    try {
      const parsed = new URL(url)
      parsed.hash = ''
      url = parsed.toString()
    } catch {
      continue
    }
    const key = url.toLowerCase().replace(/\/+$/, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    const name = String(item.name || '').trim().slice(0, 60)
    if (!name) continue
    out.push({
      id: String(item.id || '').trim().slice(0, 40),
      name,
      url,
      icon: /^https?:\/\//i.test(String(item.icon || '')) ? String(item.icon).slice(0, 500) : '',
      tag: String(item.tag || '').trim().slice(0, 24),
      note: String(item.note || '').trim().slice(0, 200),
      createdAt: Number(item.createdAt) > 0 ? Number(item.createdAt) : Date.now()
    })
  }
  return out
}

function cleanTimes(input: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!input || typeof input !== 'object') return out
  let count = 0
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (count++ >= 500) break
    const key = String(rawKey || '').trim().slice(0, 500)
    const time = Number(rawValue)
    if (!key || !Number.isFinite(time) || time <= 0) continue
    out[key] = time
  }
  return out
}

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '未登录' })
  const body = await readBody(event)
  const groups = Array.isArray(body?.groups) ? body.groups : []
  const freq = body?.freq && typeof body.freq === 'object' ? body.freq : {}
  const freqAt = cleanTimes(body?.freqAt)
  const meta = body?.freqMeta && typeof body.freqMeta === 'object' ? body.freqMeta : {}
  const freqMeta = { pin: cleanKeys(meta?.pin), hide: cleanKeys(meta?.hide) }
  const db = useDb()
  const [rows]: any = await db.query('SELECT config_json FROM users WHERE id = ? LIMIT 1', [user.id])
  let old: any = {}
  try { old = JSON.parse(rows[0]?.config_json || '{}') } catch {}
  const hasBookmarks = Object.prototype.hasOwnProperty.call(body || {}, 'bookmarks')
  const bookmarks = hasBookmarks ? cleanBookmarks(body?.bookmarks) : (Array.isArray(old.bookmarks) ? old.bookmarks : [])
  const cfg = { groups, freq, freqAt, freqMeta, bookmarks, version: Date.now() }
  await db.execute('UPDATE users SET config_json = ? WHERE id = ?', [JSON.stringify(cfg), user.id])
  return { ok: true, version: cfg.version }
})
