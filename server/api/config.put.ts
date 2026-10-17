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
  const cfg = { groups, freq, freqAt, freqMeta, version: Date.now() }
  await db.execute('UPDATE users SET config_json = ? WHERE id = ?', [JSON.stringify(cfg), user.id])
  return { ok: true, version: cfg.version }
})
