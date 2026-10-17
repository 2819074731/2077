import { setSetting } from '../../utils/settings'
import { getSiteGroups, invalidateSiteGroups } from '../../utils/siteGroups'

interface NavLink { name: string; url: string; icon?: string }
interface NavGroup { name: string; links: NavLink[] }

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const input = Array.isArray(body?.groups) ? body.groups : []
  const groups: NavGroup[] = input
    .map((g: any) => ({
      name: String(g?.name || '').trim().slice(0, 60),
      links: (Array.isArray(g?.links) ? g.links : [])
        .map((l: any) => ({
          name: String(l?.name || '').trim().slice(0, 60),
          url: String(l?.url || '').trim().slice(0, 500),
          icon: String(l?.icon || '').trim().slice(0, 500)
        }))
        .filter((l: NavLink) => l.name && /^https?:\/\//.test(l.url))
    }))
    .filter((g: NavGroup) => g.name)

  await setSetting('site_groups', groups)
  invalidateSiteGroups()
  return { ok: true, groups }
})
