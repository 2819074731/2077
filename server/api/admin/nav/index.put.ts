import { getSiteConfig, invalidateSiteConfig } from '../../../utils/siteConfig'
import { setSetting } from '../../../utils/settings'
import { navCategoryChanges, syncNavDirectory, syncNavUrlChanges } from '../../../utils/directorySync'
import { logAdmin } from '../../../utils/adminLog'

interface NavLink { name: string; url: string; icon?: string }

function iconOf(url: string, icon?: string): string {
  const given = String(icon || '').trim().slice(0, 500)
  if (given) return given
  try {
    return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}`
  } catch {
    return ''
  }
}
interface NavGroup { name: string; links: NavLink[]; recommended?: boolean }

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const body = await readBody(event)
  const input = Array.isArray(body?.groups) ? body.groups : []
  const groups: NavGroup[] = input
    .map((g: any) => ({
      name: String(g?.name || '').trim().slice(0, 60),
      recommended: !!g?.recommended,
      links: (Array.isArray(g?.links) ? g.links : [])
        .map((l: any) => ({
          name: String(l?.name || '').trim().slice(0, 60),
          url: String(l?.url || '').trim().slice(0, 500),
          icon: iconOf(String(l?.url || ''), l?.icon)
        }))
        .filter((l: NavLink) => l.name && /^https?:\/\//.test(l.url))
    }))
    .filter((g: NavGroup) => g.name)

  const current = await getSiteConfig({ fresh: true })
  const recommended = Array.isArray(body?.recommended)
    ? body.recommended
        .map((l: any) => ({ name: String(l?.name || '').trim().slice(0, 60), url: String(l?.url || '').trim().slice(0, 500), icon: iconOf(String(l?.url || ''), l?.icon) }))
        .filter((l: NavLink) => l.name && /^https?:\/\//.test(l.url))
    : current.recommended

  await setSetting('site_config', { groups, recommended })
  invalidateSiteConfig()
  let sync: { created: number; updated: number; skipped: number } | null = null
  let syncError = ''
  let urlChanges: Array<{ id: number; fromUrl: string; toUrl: string }> = []
  try {
    urlChanges = await syncNavUrlChanges(current.groups, groups)
    sync = await syncNavDirectory(groups, recommended, await navCategoryChanges(current.groups, groups))
  } catch (err: any) {
    syncError = err?.message || '目录同步失败'
  }
  await logAdmin(event, user, 'nav.save', '', {
    groups: groups.length,
    links: groups.reduce((n, group) => n + group.links.length, 0),
    sync,
    syncError,
    urlChanges
  })
  return { ok: true, groups, recommended, sync, syncError, urlChanges }
})
