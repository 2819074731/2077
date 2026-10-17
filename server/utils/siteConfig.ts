import { DEFAULT_GROUPS, RECOMMENDED_LINKS } from '#shared/nav'

export interface SiteNavLink { name: string; url: string; icon?: string }
export interface SiteNavGroup { name: string; links: SiteNavLink[]; recommended?: boolean }

interface SiteConfig {
  groups: SiteNavGroup[]
  recommended?: SiteNavLink[]
}

let cache: { data: SiteConfig; at: number } | null = null
const TTL = 1000 * 60 * 5

/** 内置默认站点配置（未在后台配置时使用）。 */
function builtinConfig(): SiteConfig {
  return {
    groups: DEFAULT_GROUPS.map((g) => ({
      name: g.name,
      recommended: !!g.recommended,
      links: g.links.map((l) => ({ name: l.name, url: l.url, icon: l.icon }))
    })),
    recommended: RECOMMENDED_LINKS.map((l) => ({ name: l.name, url: l.url }))
  }
}

/** 读取站点配置；后台未配置或配置为空时回退内置默认，避免前台只剩残缺分组。 */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  const { getSetting } = await import('./settings')
  const stored = await getSetting<SiteConfig | null>('site_config', null)
  let data: SiteConfig
  if (stored && Array.isArray(stored.groups) && stored.groups.length) {
    data = {
      groups: stored.groups,
      recommended: Array.isArray(stored.recommended) && stored.recommended.length
        ? stored.recommended
        : RECOMMENDED_LINKS.map((l) => ({ name: l.name, url: l.url }))
    }
  } else {
    data = builtinConfig()
  }
  cache = { data, at: Date.now() }
  return data
}

export function invalidateSiteConfig(): void {
  cache = null
}
