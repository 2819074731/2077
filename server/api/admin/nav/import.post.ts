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

function sanitizeGroups(input: any): NavGroup[] {
  return (Array.isArray(input) ? input : [])
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
}

function sanitizeRecommended(input: any): NavLink[] {
  return (Array.isArray(input) ? input : [])
    .map((l: any) => ({
      name: String(l?.name || '').trim().slice(0, 60),
      url: String(l?.url || '').trim().slice(0, 500),
      icon: iconOf(String(l?.url || ''), l?.icon)
    }))
    .filter((l: NavLink) => l.name && /^https?:\/\//.test(l.url))
}

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const body = await readBody(event)
  const data = body?.data && typeof body.data === 'object' ? body.data : body
  const groups = sanitizeGroups(data?.groups)
  if (!groups.length) throw createError({ statusCode: 400, statusMessage: '导入数据无效：缺少分组' })
  const current = await getSiteConfig({ fresh: true })
  const recommended = Array.isArray(data?.recommended)
    ? sanitizeRecommended(data.recommended)
    : (current.recommended || [])
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
  await logAdmin(event, user, 'nav.import', '', {
    groups: groups.length,
    links: groups.reduce((n, group) => n + group.links.length, 0),
    sync,
    syncError,
    urlChanges
  })
  return { ok: true, groups, recommended, sync, syncError, urlChanges }
})
