import { getGithubContents } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-contents', 60, 60_000)

  const q = getQuery(event)
  const repo = String(q.repo || '').trim()
  const path = String(q.path || '')
  const result = await getGithubContents(repo, path)

  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=180')
  return result
})
