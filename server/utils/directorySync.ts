import { canonicalKey, iconForUrl } from './directory'
import { getSiteCategories } from './categories'
import { getSiteConfig, invalidateSiteConfig } from './siteConfig'
import { setSetting } from './settings'
import { suggestGroupName } from '#shared/classify'

interface NavLink { name: string; url: string; icon?: string }
interface NavGroup { name: string; links: NavLink[]; recommended?: boolean }

export interface NavDirectorySyncResult {
  created: number
  updated: number
  skipped: number
}

export function pickCategory(group: string, categories: string[]): string {
  const direct = categories.find((c) => c === group)
  if (direct) return direct
  const compact = group.toLowerCase().replace(/[与和及\s]/g, '')
  const matched = categories.find((c) => {
    const key = c.toLowerCase().replace(/[与和及\s]/g, '')
    return key === compact || key.includes(compact) || compact.includes(key)
  })
  return matched || '其他'
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/[与和及\s]/g, '')
}

export async function navCategoryChanges(previous: NavGroup[], next: NavGroup[]): Promise<Set<string>> {
  const categories = await getSiteCategories()
  const mapOf = (groups: NavGroup[]) => {
    const map = new Map<string, string>()
    for (const group of groups) {
      const category = pickCategory(group.name, categories)
      for (const link of group.links) {
        const key = canonicalKey(link.url)
        if (key) map.set(key, category)
      }
    }
    return map
  }
  const before = mapOf(previous)
  const after = mapOf(next)
  const changed = new Set<string>()
  for (const [key, category] of after) {
    if (before.get(key) !== category) changed.add(key)
  }
  return changed
}

export async function syncNavDirectory(groups: NavGroup[], recommended: NavLink[], updateKeys?: Set<string>): Promise<NavDirectorySyncResult> {
  const db = useDb()
  const categories = await getSiteCategories()
  const [rows]: any = await db.query('SELECT id, url, canonical_key, category FROM directory_entries')
  const existing = new Map<string, { id: number; category: string }>()
  for (const row of rows) {
    const key = String(row.canonical_key || '') || canonicalKey(String(row.url || ''))
    if (!key) continue
    existing.set(key, { id: Number(row.id), category: String(row.category || '') })
  }
  const queue: Array<{ link: NavLink; category: string }> = []
  const queued = new Set<string>()

  for (const group of groups) {
    const category = pickCategory(group.name, categories)
    for (const link of group.links) {
      const key = canonicalKey(link.url)
      if (key && queued.has(key)) continue
      if (key) queued.add(key)
      queue.push({ link, category })
    }
  }
  for (const link of recommended) {
    const key = canonicalKey(link.url)
    if (key && queued.has(key)) continue
    if (key) queued.add(key)
    const category = pickCategory(suggestGroupName({ name: link.name, url: link.url }, categories), categories)
    queue.push({ link, category })
  }

  let created = 0
  let updated = 0
  let skipped = 0
  for (const { link, category } of queue) {
    const key = canonicalKey(link.url)
    if (!key) {
      skipped++
      continue
    }
    const row = existing.get(key)
    if (row) {
      if (updateKeys && !updateKeys.has(key)) {
        skipped++
        continue
      }
      if (row.category !== category) {
        try {
          await db.execute('UPDATE directory_entries SET category = ? WHERE id = ?', [category, row.id])
          row.category = category
          updated++
        } catch {
          skipped++
        }
      } else {
        skipped++
      }
      continue
    }
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
      if (res.affectedRows) {
        created++
        existing.set(key, { id: Number(res.insertId), category })
      } else {
        skipped++
      }
    } catch {
      skipped++
    }
  }
  return { created, updated, skipped }
}

/**
 * 目录站点分类变更后，把导航池中同一网址的链接移动到对应分组。
 * 目标分组不存在时新建，保证两边分类一致。
 */
export async function syncNavCategoryFromDirectory(urls: string[], category: string): Promise<{ moved: number; createdGroup: boolean }> {
  const name = String(category || '').trim()
  const keys = new Set(urls.map((url) => canonicalKey(url)).filter(Boolean))
  if (!name || !keys.size) return { moved: 0, createdGroup: false }

  const current = await getSiteConfig({ fresh: true })
  const groups = (current.groups || []).map((g) => ({ ...g, links: [...(g.links || [])] }))
  const hasMatch = groups.some((g) => g.links.some((link) => keys.has(canonicalKey(link.url))))
  if (!hasMatch) return { moved: 0, createdGroup: false }

  const compact = compactName(name)
  let target = groups.find((g) => g.name === name)
  if (!target) {
    target = groups.find((g) => {
      const key = compactName(g.name)
      return !!key && (key === compact || key.includes(compact) || compact.includes(key))
    })
  }
  let createdGroup = false
  if (!target) {
    target = { name, links: [] }
    groups.push(target)
    createdGroup = true
  }

  let moved = 0
  for (const group of groups) {
    if (group === target) continue
    const keep: NavLink[] = []
    for (const link of group.links) {
      const key = canonicalKey(link.url)
      if (!keys.has(key)) {
        keep.push(link)
        continue
      }
      moved++
      if (!target.links.some((item) => canonicalKey(item.url) === key)) target.links.push(link)
    }
    group.links = keep
  }
  if (!moved && !createdGroup) return { moved: 0, createdGroup: false }

  const nextGroups = groups.filter((g) => g.links.length || g === target)
  await setSetting('site_config', {
    groups: nextGroups,
    recommended: Array.isArray(current.recommended) ? current.recommended : []
  })
  invalidateSiteConfig()
  return { moved, createdGroup }
}
