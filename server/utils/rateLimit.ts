import type { H3Event } from 'h3'

interface Bucket { count: number; reset: number }
const buckets = new Map<string, Bucket>()

function normalizeIp(value: string): string {
  const ip = String(value || '').trim()
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

/**
 * 只信任反向代理覆盖写入的 x-real-ip；
 * 否则取 X-Forwarded-For 最后一跳，避免客户端自带的伪造值绕过限流。
 */
function clientIp(event: H3Event): string {
  const real = normalizeIp(getRequestHeader(event, 'x-real-ip') || '')
  if (real) return real
  const xff = getRequestHeader(event, 'x-forwarded-for') || ''
  const parts = xff.split(',').map(v => normalizeIp(v)).filter(Boolean)
  const last = parts[parts.length - 1]
  return last || normalizeIp(event.node.req.socket.remoteAddress || '') || 'unknown'
}

function memoryLimit(id: string, limit: number, windowMs: number): void {
  const now = Date.now()
  let bucket = buckets.get(id)
  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset: now + windowMs }
    buckets.set(id, bucket)
  }
  bucket.count++
  if (buckets.size > 5000) {
    for (const [key, value] of buckets) {
      if (now >= value.reset) buckets.delete(key)
    }
  }
  if (bucket.count > limit) {
    throw createError({ statusCode: 429, statusMessage: '请求过于频繁，请稍后再试' })
  }
}

export async function rateLimit(event: H3Event, key: string, limit: number, windowMs: number): Promise<void> {
  const now = Date.now()
  const id = `${key}:${clientIp(event)}`.slice(0, 191)

  try {
    const db = useDb()
    await db.execute(
      `INSERT INTO rate_limits (k, count, reset_at) VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE
         count = IF(reset_at <= ?, 1, count + 1),
         reset_at = IF(reset_at <= ?, ?, reset_at)`,
      [id, now + windowMs, now, now, now + windowMs]
    )
    const [rows]: any = await db.query('SELECT count, reset_at FROM rate_limits WHERE k = ? LIMIT 1', [id])
    const row = rows[0]
    if (row && Number(row.reset_at) > now && Number(row.count) > limit) {
      throw createError({ statusCode: 429, statusMessage: '请求过于频繁，请稍后再试' })
    }
    return
  } catch (error: any) {
    if (error?.statusCode === 429) throw error
  }

  // 数据库不可用时退回进程内限流，保证接口仍可服务。
  memoryLimit(id, limit, windowMs)
}
