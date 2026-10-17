import { normalizeSiteSettings, type SiteSettings } from '#shared/siteSettings'
import { getSetting, setSetting } from './settings'

const SETTINGS_KEY = 'site_settings'
const TTL = 5000

let cache: { data: SiteSettings; at: number } | null = null

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  const stored = await getSetting<Partial<SiteSettings> | null>(SETTINGS_KEY, null)
  const data = normalizeSiteSettings(stored)
  cache = { data, at: Date.now() }
  return data
}

export async function saveSiteSettings(input: any): Promise<SiteSettings> {
  const data = normalizeSiteSettings(input)
  await setSetting(SETTINGS_KEY, data)
  cache = { data, at: Date.now() }
  return data
}

export function invalidateSiteSettings(): void {
  cache = null
}
