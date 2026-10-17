import { getSiteConfig } from './siteConfig'

export interface NavLink { name: string; url: string; icon?: string }
export interface NavGroup { name: string; links: NavLink[]; recommended?: boolean }

/** @deprecated 使用 siteConfig.ts 的 getSiteConfig / invalidateSiteConfig */
export async function getSiteGroups(): Promise<NavGroup[]> {
  const cfg = await getSiteConfig()
  return cfg.groups
}

export { invalidateSiteConfig as invalidateSiteGroups } from './siteConfig'
