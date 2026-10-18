import { getGithubUser } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'
import { requireGithubSettings } from '../../utils/githubSettings'
import { isGithubImageHost, signGithubImageUrl } from '../../utils/githubAsset'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-user', 40, 60_000)
  const settings = await requireGithubSettings()

  const q = getQuery(event)
  const login = String(q.login || '').trim()
  const result = await getGithubUser(login)

  const avatar = (url: string): string => {
    if (!settings.antiHotlink || !url || !isGithubImageHost(url)) return url
    return signGithubImageUrl(url, settings.assetTtlSec)
  }

  setHeader(event, 'Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
  return {
    ...result,
    user: { ...result.user, avatar: avatar(result.user.avatar) }
  }
})
