import { normalizeGoogleQuery } from '#shared/googleSearch'
import { searchGoogle } from '../../utils/google'
import { requireGoogleSearchSettings } from '../../utils/googleSettings'
import { rateLimit } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'google-search', 30, 60_000)
  const settings = await requireGoogleSearchSettings()

  const q = getQuery(event)
  const query = normalizeGoogleQuery(q.q)
  if (!query) throw createError({ statusCode: 400, statusMessage: '请输入搜索关键词' })

  const page = Math.max(1, Math.min(settings.maxPages, Number.parseInt(String(q.page || '1'), 10) || 1))
  const result = await searchGoogle(query, page)

  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=240')
  return result
})
