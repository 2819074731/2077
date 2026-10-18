const CACHE_TTL = 300 * 1000
const DEFAULT_LIMIT = 5000
const MAX_LIMIT = 5000

interface Payload {
  items: any[]
  categories: any[]
}

const cache = new Map<number, { at: number; value: Payload }>()

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(q.limit) || DEFAULT_LIMIT))
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')

  const now = Date.now()
  const hit = cache.get(limit)
  if (hit && now - hit.at < CACHE_TTL) return hit.value

  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, name, url, category, detail_enabled, updated_at
     FROM directory_entries WHERE status = 'published' AND health_hidden = 0
     ORDER BY category ASC, featured DESC, sort ASC, id DESC LIMIT ?`,
    [limit]
  )
  const [categories]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries
     WHERE status = 'published' AND health_hidden = 0
     GROUP BY category ORDER BY n DESC, category ASC`
  )

  const payload: Payload = { items: rows, categories }
  cache.set(limit, { at: now, value: payload })
  if (cache.size > 16) cache.delete(cache.keys().next().value as number)
  return payload
})
