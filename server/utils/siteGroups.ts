interface NavLink { name: string; url: string; icon?: string }
export interface NavGroup { name: string; links: NavLink[] }

let cache: { data: NavGroup[]; at: number } | null = null
const TTL = 1000 * 60 * 5

export async function getSiteGroups(): Promise<NavGroup[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  const { getSetting } = await import('./settings')
  const groups = await getSetting<NavGroup[]>('site_groups', [])
  cache = { data: groups, at: Date.now() }
  return groups
}

export function invalidateSiteGroups(): void {
  cache = null
}
