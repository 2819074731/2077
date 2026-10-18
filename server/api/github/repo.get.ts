import { getGithubRepo } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-repo', 60, 60_000)

  const q = getQuery(event)
  const repo = String(q.repo || '').trim()
  const result = await getGithubRepo(repo)

  setHeader(event, 'Cache-Control', 'public, max-age=120, stale-while-revalidate=300')
  return { repo: result }
})
