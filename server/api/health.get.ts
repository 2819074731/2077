import { statfs } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const ip = String(getRequestHeader(event, 'x-real-ip') || '').trim()
  const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
  const me = isLocal ? null : await getSessionUser(event).catch(() => null)

  let dbOk = false
  try {
    const db = useDb()
    const [rows]: any = await db.query('SELECT 1 AS ok')
    dbOk = Number(rows?.[0]?.ok) === 1
  } catch {}

  let diskOk = false
  let diskFree = 0
  try {
    const fs = await statfs('/')
    diskFree = Number(fs.bavail) * Number(fs.bsize)
    diskOk = Number.isFinite(diskFree)
  } catch {}

  if (!isLocal && !me?.is_admin) {
    return { status: dbOk ? 'ok' : 'degraded', time: new Date().toISOString() }
  }

  const memory = process.memoryUsage()

  return {
    status: dbOk && diskOk ? 'ok' : 'degraded',
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    memory: { rss: memory.rss },
    disk: { free: diskFree },
    db: dbOk,
    checks: { db: dbOk, disk: diskOk }
  }
})
