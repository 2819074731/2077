import { normalizeQuery } from '#shared/search'
import { recordSiteClick } from '../../utils/siteSearch'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'site-search-click', 120, 60_000)
  const body = await readBody(event).catch(() => null)
  const term = normalizeQuery(body?.term, 120)
  if (term && !/^https?:\/\//i.test(term)) {
    void recordSiteClick(useDb(), term)
  }
  return { ok: true }
})
