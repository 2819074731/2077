import { getGithubRepo } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'
import { requireGithubSettings } from '../../utils/githubSettings'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-repo', 60, 60_000)
  await requireGithubSettings()

  const q = getQuery(event)
  const repo = String(q.repo || '').trim()
  const result = await getGithubRepo(repo)

  setHeader(event, 'Cache-Control', 'public, max-age=120, stale-while-revalidate=300')
  return { repo: result }
})
