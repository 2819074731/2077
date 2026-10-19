import { getSiteConfig } from '../../../utils/siteConfig'
import {
  previewNavCategorySync,
  previewNavCategoryFromDirectory,
  previewNavUrlChanges
} from '../../../utils/directorySync'

interface NavLink { name: string; url: string; icon?: string }
interface NavGroup { name: string; links: NavLink[] }

function cleanGroups(input: unknown): NavGroup[] {
  return (Array.isArray(input) ? input : [])
    .map((group: any) => ({
      name: String(group?.name || '').trim().slice(0, 60),
      links: (Array.isArray(group?.links) ? group.links : [])
        .map((link: any) => ({
          name: String(link?.name || '').trim().slice(0, 60),
          url: String(link?.url || '').trim().slice(0, 500),
          icon: String(link?.icon || '').trim().slice(0, 500)
        }))
        .filter((link: NavLink) => link.name && /^https?:\/\//i.test(link.url))
    }))
    .filter((group: NavGroup) => group.name && group.links.length)
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const kind = String(body?.kind || 'nav')

  if (kind === 'directory') {
    const urls = (Array.isArray(body?.urls) ? body.urls : [])
      .map((url: any) => String(url || '').trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 10)
    const category = String(body?.category || '').trim().slice(0, 60)
    const result = await previewNavCategoryFromDirectory(urls, category)
    return { kind, category, ...result }
  }

  const groups = cleanGroups(body?.groups)
  const current = await getSiteConfig({ fresh: true })
  const [directory, urlChanges] = await Promise.all([
    previewNavCategorySync(groups),
    previewNavUrlChanges(current.groups, groups)
  ])
  return { kind: 'nav', directory, urlChanges }
})
