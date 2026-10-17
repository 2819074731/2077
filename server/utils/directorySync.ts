import { canonicalKey, iconForUrl } from './directory'
import { getSiteCategories } from './categories'
import { suggestGroupName } from '#shared/classify'

interface NavLink { name: string; url: string; icon?: string }
interface NavGroup { name: string; links: NavLink[]; recommended?: boolean }

function pickCategory(group: string, categories: string[]): string {
  const direct = categories.find((c) => c === group)
  if (direct) return direct
  const compact = group.toLowerCase().replace(/[与和及\s]/g, '')
  const matched = categories.find((c) => {
    const key = c.toLowerCase().replace(/[与和及\s]/g, '')
    return key === compact || key.includes(compact) || compact.includes(key)
  })
  return matched || '其他'
}

export async function syncNavDirectory(groups: NavGroup[], recommended: NavLink[]): Promise<{ created: number; skipped: number }> {
  const db = useDb()
  const categories = await getSiteCategories()
  const [rows]: any = await db.query('SELECT canonical_key FROM directory_entries')
  const seen = new Set<string>(rows.map((r: any) => String(r.canonical_key || '')))
  const queue: Array<{ link: NavLink; category: string }> = []

  for (const group of groups) {
    const category = pickCategory(group.name, categories)
    for (const link of group.links) queue.push({ link, category })
  }
  for (const link of recommended) {
    const category = pickCategory(suggestGroupName({ name: link.name, url: link.url }, categories), categories)
    queue.push({ link, category })
  }

  let created = 0
  let skipped = 0
  for (const { link, category } of queue) {
    const key = canonicalKey(link.url)
    if (!key || seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    try {
      const [res]: any = await db.execute(
        `INSERT IGNORE INTO directory_entries
          (name, url, icon, category, title, description, keywords, featured, sort, status, detail_enabled)
         VALUES (?, ?, ?, ?, ?, '', '', 0, 0, 'published', 1)`,
        [
          String(link.name || '').slice(0, 80),
          link.url,
          link.icon || iconForUrl(link.url),
          category,
          String(link.name || '').slice(0, 200)
        ]
      )
      if (res.affectedRows) created++
      else skipped++
    } catch {
      skipped++
    }
  }
  return { created, skipped }
}
