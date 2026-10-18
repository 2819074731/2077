import { normalizeGithubQuery, searchGithub } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'
import { requireGithubSettings } from '../../utils/githubSettings'

const SORTS = new Set(['best', 'stars', 'forks', 'updated'])

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-search', 40, 60_000)
  const settings = await requireGithubSettings()

  const q = getQuery(event)
  const query = normalizeGithubQuery(q.q)
  if (!query) throw createError({ statusCode: 400, statusMessage: '请输入搜索关键词' })

  const page = Math.max(1, Math.min(settings.maxPages, Number.parseInt(String(q.page || '1'), 10) || 1))
  const rawSort = String(q.sort || settings.defaultSort)
  const sort = (SORTS.has(rawSort) ? rawSort : settings.defaultSort) as 'best' | 'stars' | 'forks' | 'updated'

  const result = await searchGithub(query, page, sort)
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=240')
  return result
})
