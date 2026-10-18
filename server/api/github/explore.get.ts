import { getGithubExplore, type GithubExploreType } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'
import { requireGithubSettings } from '../../utils/githubSettings'
import { isGithubImageHost, signGithubImageUrl } from '../../utils/githubAsset'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-explore', 40, 60_000)
  const settings = await requireGithubSettings()

  const q = getQuery(event)
  const repo = String(q.repo || '').trim()
  const type = String(q.type || 'issues') as GithubExploreType
  const allowed: Record<GithubExploreType, boolean> = {
    issues: settings.showIssues,
    pulls: settings.showPulls,
    commits: settings.showCommits,
    contributors: settings.showContributors,
    branches: settings.showRefs,
    tags: settings.showRefs,
    releases: settings.showReleases
  }
  if (!Object.prototype.hasOwnProperty.call(allowed, type) || !allowed[type]) {
    throw createError({ statusCode: 404, statusMessage: '该内容未开放' })
  }
  const result = await getGithubExplore(repo, type)

  const avatar = (url: string): string => {
    if (!settings.antiHotlink || !url || !isGithubImageHost(url)) return url
    return signGithubImageUrl(url, settings.assetTtlSec)
  }
  const issues = result.issues.map(item => ({ ...item, avatar: avatar(item.avatar) }))
  const pulls = result.pulls.map(item => ({ ...item, avatar: avatar(item.avatar) }))

  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return {
    issues,
    pulls,
    commits: result.commits.map(item => ({ ...item, avatar: avatar(item.avatar) })),
    contributors: result.contributors.map(item => ({ ...item, avatar: avatar(item.avatar) })),
    branches: result.branches,
    tags: result.tags,
    releases: result.releases,
    partial: result.partial
  }
})
