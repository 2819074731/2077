import type { H3Event } from 'h3'

interface Bucket { count: number; reset: number }
const buckets = new Map<string, Bucket>()

function clientIp(event: H3Event): string {
  const xff = getRequestHeader(event, 'x-forwarded-for') || ''
  return xff.split(',')[0].trim() || event.node.req.socket.remoteAddress || 'unknown'
}

export function rateLimit(event: H3Event, key: string, limit: number, windowMs: number): void {
  const now = Date.now()
  const id = `${key}:${clientIp(event)}`
  let b = buckets.get(id)
  if (!b || now >= b.reset) {
    b = { count: 0, reset: now + windowMs }
    buckets.set(id, b)
  }
  b.count++
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.reset) buckets.delete(k)
  }
  if (b.count > limit) {
    throw createError({ statusCode: 429, statusMessage: '请求过于频繁，请稍后再试' })
  }
}
