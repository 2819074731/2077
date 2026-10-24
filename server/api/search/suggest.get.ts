import { normalizeQuery } from '#shared/search'
import { searchSuggestions } from '../../utils/siteSearch'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'site-suggest', 180, 60_000)
  const query = getQuery(event)
  const q = normalizeQuery(query.q, 60)
  const items = await searchSuggestions(useDb(), q, query.limit)
  setHeader(event, 'Cache-Control', q ? 'private, max-age=30' : 'public, max-age=60, stale-while-revalidate=300')
  return { q, items }
})
