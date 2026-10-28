import type { GoogleSearchSettings } from '#shared/siteSettings'
import { getSiteSettings } from './siteSettings'

export async function getGoogleSearchSettings(): Promise<GoogleSearchSettings> {
  const settings = await getSiteSettings()
  return settings.google
}

export async function requireGoogleSearchSettings(): Promise<GoogleSearchSettings> {
  const google = await getGoogleSearchSettings()
  if (!google.enabled) {
    throw createError({ statusCode: 503, statusMessage: 'Google 站内搜索暂未开放' })
  }
  return google
}
