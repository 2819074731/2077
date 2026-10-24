import { normalizeQuery } from '#shared/search'
import { recordSiteSearch, siteSearch } from '../../utils/siteSearch'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'site-search', 120, 60_000)
  const query = getQuery(event)
  const started = performance.now()
  const db = useDb()
  const result = await siteSearch(db, {
    q: query.q,
    type: query.type,
    category: query.category,
    sort: query.sort,
    page: query.page,
    size: query.size
  })
  const took = Math.max(0, Math.round(performance.now() - started))

  if (result.q && result.page === 1) {
    void recordSiteSearch(db, result.q, result.total, took)
  }
  if (result.q) setHeader(event, 'Cache-Control', 'private, no-store')
  else setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

  return { ...result, took, degraded: false, query: normalizeQuery(query.q) }
})
