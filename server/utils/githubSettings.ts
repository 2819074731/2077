import type { GithubSettings } from '#shared/siteSettings'
import { getSiteSettings } from './siteSettings'

export async function getGithubSettings(): Promise<GithubSettings> {
  const settings = await getSiteSettings()
  return settings.github
}

export async function requireGithubSettings(): Promise<GithubSettings> {
  const github = await getGithubSettings()
  if (!github.enabled) {
    throw createError({ statusCode: 503, statusMessage: 'GitHub 站内搜索暂未开放' })
  }
  return github
}
