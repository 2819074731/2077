import { getGithubRelease } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'
import { requireGithubSettings } from '../../utils/githubSettings'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-release', 30, 60_000)
  const settings = await requireGithubSettings()
  if (!settings.showReleases) {
    throw createError({ statusCode: 404, statusMessage: '未开放 Release 查看' })
  }

  const repo = String(getQuery(event).repo || '').trim()
  const release = await getGithubRelease(repo)
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return { release }
})
