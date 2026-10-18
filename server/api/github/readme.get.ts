import { getGithubReadme } from '../../utils/github'
import { renderGithubMarkdown } from '../../utils/githubMarkdown'
import { rateLimit } from '../../utils/rateLimit'
import { requireGithubSettings } from '../../utils/githubSettings'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-readme', 60, 60_000)
  const settings = await requireGithubSettings()
  if (!settings.showReadme) {
    throw createError({ statusCode: 404, statusMessage: '未开放 README 预览' })
  }

  const q = getQuery(event)
  const repo = String(q.repo || '').trim()
  const readme = await getGithubReadme(repo)
  setHeader(event, 'Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
  if (!readme) return { readme: null }

  const html = renderGithubMarkdown(readme.markdown, {
    repo,
    branch: readme.branch,
    readmePath: readme.path,
    assetTtlSec: settings.assetTtlSec
  })

  return {
    readme: {
      path: readme.path,
      branch: readme.branch,
      truncated: readme.truncated,
      html
    }
  }
})
