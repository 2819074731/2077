import { getGithubIssue } from '../../utils/github'
import { renderGithubMarkdown } from '../../utils/githubMarkdown'
import { rateLimit } from '../../utils/rateLimit'
import { requireGithubSettings } from '../../utils/githubSettings'
import { isGithubImageHost, signGithubImageUrl } from '../../utils/githubAsset'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-issue', 60, 60_000)
  const settings = await requireGithubSettings()
  if (!settings.showIssues) {
    throw createError({ statusCode: 404, statusMessage: '未开放 Issues 预览' })
  }

  const q = getQuery(event)
  const repo = String(q.repo || '').trim()
  const number = Number(q.number)
  const result = await getGithubIssue(repo, number)

  const avatar = (url: string): string => {
    if (!settings.antiHotlink || !url || !isGithubImageHost(url)) return url
    return signGithubImageUrl(url, settings.assetTtlSec)
  }
  const render = (body: string): string => renderGithubMarkdown(body, {
    repo,
    branch: 'HEAD',
    readmePath: '',
    assetTtlSec: settings.assetTtlSec
  })

  const { body, ...issue } = result.issue
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return {
    issue: {
      ...issue,
      avatar: avatar(result.issue.avatar),
      bodyHtml: render(body)
    },
    comments: result.comments.map(item => ({
      ...item,
      avatar: avatar(item.avatar),
      bodyHtml: render(item.body)
    })),
    partial: result.partial
  }
})
