import { canonicalKey, iconForUrl } from './directory'
import { getSiteCategories } from './categories'
import { getSiteConfig, invalidateSiteConfig } from './siteConfig'
import { setSetting } from './settings'
import { touchDirectoryCache } from './directoryCache'
import { notifySearchUrls } from './searchPush'
import { suggestGroupName } from '#shared/classify'

interface NavLink { name: string; url: string; icon?: string }
interface NavGroup { name: string; links: NavLink[]; recommended?: boolean }

export interface DirectoryCategoryChange {
  id: number
  name: string
  url: string
  from: string
  to: string
}

export interface NavUrlChange {
  id: number
  name: string
  fromUrl: string
  toUrl: string
}

export interface NavDirectorySyncResult {
  created: number
  updated: number
  skipped: number
  changes: DirectoryCategoryChange[]
}

export interface NavCategorySyncResult {
  moved: number
  createdGroup: boolean
  category: string
  links: Array<{ name: string; url: string; from: string; to: string }>
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

export async function navCategoryMap(groups: NavGroup[]): Promise<Map<string, string>> {
  const categories = await getSiteCategories()
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

export async function navCategoryChanges(previous: NavGroup[], next: NavGroup[]): Promise<Set<string>> {
  const before = await navCategoryMap(previous)
  const after = await navCategoryMap(next)
  const changed = new Set<string>()
  for (const [key, category] of after) {
    if (before.get(key) !== category) changed.add(key)
  }
  return changed
}

/** 预览导航保存后，目录池中会被改动分类的站点。 */
export async function previewNavCategorySync(groups: NavGroup[]): Promise<DirectoryCategoryChange[]> {
  const current = await getSiteConfig({ fresh: true })
  const changed = await navCategoryChanges(current.groups, groups)
  if (!changed.size) return []
  const desired = await navCategoryMap(groups)
  const keys = [...changed]
  const urls = [...new Set(groups.flatMap((group) => group.links
    .filter((link) => changed.has(canonicalKey(link.url)))
    .map((link) => String(link.url || ''))))]
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, name, url, category, canonical_key FROM directory_entries
     WHERE canonical_key IN (${keys.map(() => '?').join(',')}) OR url IN (${urls.map(() => '?').join(',')})`,
    [...keys, ...urls]
  )
  const changes: DirectoryCategoryChange[] = []
  for (const row of rows) {
    const key = canonicalKey(String(row.url || '')) || String(row.canonical_key || '')
    const to = desired.get(key) || desired.get(String(row.canonical_key || ''))
    if (!to || to === String(row.category || '')) continue
    changes.push({
      id: Number(row.id),
      name: String(row.name || ''),
      url: String(row.url || ''),
      from: String(row.category || ''),
      to
    })
  }
  return changes
}

export async function syncNavDirectory(groups: NavGroup[], recommended: NavLink[], updateKeys?: Set<string>): Promise<NavDirectorySyncResult> {
  const db = useDb()
  const categories = await getSiteCategories()
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

  if (!queue.length) return { created: 0, updated: 0, skipped: 0, changes: [] }

  const keys = [...new Set(queue.map(({ link }) => canonicalKey(link.url)).filter(Boolean))]
  const urls = [...new Set(queue.map(({ link }) => String(link.url || '')).filter(Boolean))]
  const existing = new Map<string, { id: number; category: string; name: string; url: string }>()
  if (keys.length) {
    const [rows]: any = await db.query(
      `SELECT id, name, url, canonical_key, category FROM directory_entries
       WHERE canonical_key IN (${keys.map(() => '?').join(',')})
          OR url IN (${urls.map(() => '?').join(',')})`,
      [...keys, ...urls]
    )
    for (const row of rows) {
      const key = String(row.canonical_key || '') || canonicalKey(String(row.url || ''))
      if (!key) continue
      existing.set(key, {
        id: Number(row.id),
        category: String(row.category || ''),
        name: String(row.name || ''),
        url: String(row.url || '')
      })
    }
  }

  let created = 0
  let updated = 0
  let skipped = 0
  const changes: DirectoryCategoryChange[] = []
  const searchUrls: string[] = []

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
          changes.push({ id: row.id, name: row.name, url: row.url, from: row.category, to: category })
          searchUrls.push(`/site?category=${encodeURIComponent(row.category)}`, `/site?category=${encodeURIComponent(category)}`)
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
        const id = Number(res.insertId)
        existing.set(key, { id, category, name: String(link.name || ''), url: link.url })
        created++
        searchUrls.push(`/site/${id}.html`, `/site?category=${encodeURIComponent(category)}`)
      } else {
        skipped++
      }
    } catch {
      skipped++
    }
  }

  if (created || updated) {
    await touchDirectoryCache()
    if (searchUrls.length) notifySearchUrls([...new Set(searchUrls)])
  }
  return { created, updated, skipped, changes }
}

/** 预览导航中网址变更后，目录池会被改写的条目。 */
export async function previewNavUrlChanges(previous: NavGroup[], next: NavGroup[]): Promise<NavUrlChange[]> {
  const db = useDb()
  const prev = previous.flatMap((group) => group.links.map((link) => ({
    group: group.name,
    name: String(link.name || '').trim(),
    url: String(link.url || ''),
    key: canonicalKey(link.url),
    used: false
  })))
  const changes: NavUrlChange[] = []
  for (const group of next) {
    for (const link of group.links) {
      const nextKey = canonicalKey(link.url)
      if (!nextKey) continue
      const found = prev.find((item) => !item.used
        && item.group === group.name
        && item.name === String(link.name || '').trim()
        && item.key
        && item.key !== nextKey)
      if (!found) continue
      found.used = true
      const [rows]: any = await db.query(
        'SELECT id, name, url, category FROM directory_entries WHERE canonical_key = ? LIMIT 1',
        [found.key]
      )
      const row = rows[0]
      if (!row) continue
      const [dup]: any = await db.query(
        'SELECT id FROM directory_entries WHERE canonical_key = ? LIMIT 1',
        [nextKey]
      )
      if (dup[0]) continue
      changes.push({
        id: Number(row.id),
        name: String(row.name || ''),
        fromUrl: String(row.url || ''),
        toUrl: String(link.url || '')
      })
    }
  }
  return changes
}

/** 导航中网址变更后，同步目录条目的 url 与 canonical_key。 */
export async function syncNavUrlChanges(previous: NavGroup[], next: NavGroup[]): Promise<NavUrlChange[]> {
  const changes = await previewNavUrlChanges(previous, next)
  if (!changes.length) return []
  const db = useDb()
  const searchUrls: string[] = []
  const applied: NavUrlChange[] = []
  for (const change of changes) {
    try {
      const [rows]: any = await db.query(
        'SELECT category FROM directory_entries WHERE id = ? LIMIT 1',
        [change.id]
      )
      // canonical_key 是生成列，随 url 自动更新，不能显式赋值。
      await db.execute(
        `UPDATE directory_entries
         SET url = ?, final_url = '', http_status = NULL, checked_at = NULL,
             health_fail_count = 0, health_hidden = 0
         WHERE id = ?`,
        [change.toUrl, change.id]
      )
      applied.push(change)
      searchUrls.push(`/site/${change.id}.html`)
      const category = String(rows[0]?.category || '')
      if (category) searchUrls.push(`/site?category=${encodeURIComponent(category)}`)
    } catch {}
  }
  if (applied.length) {
    await touchDirectoryCache()
    notifySearchUrls([...new Set(searchUrls)])
  }
  return applied
}

/** 预览目录分类变更会移动的导航链接。 */
export async function previewNavCategoryFromDirectory(urls: string[], category: string): Promise<{
  links: Array<{ name: string; url: string; from: string; to: string }>
  createdGroup: boolean
}> {
  const name = String(category || '').trim()
  const keys = new Set(urls.map((url) => canonicalKey(url)).filter(Boolean))
  if (!name || !keys.size) return { links: [], createdGroup: false }
  const current = await getSiteConfig({ fresh: true })
  const groups = current.groups || []
  const compact = compactName(name)
  const target = groups.find((g) => g.name === name)
    || groups.find((g) => {
      const key = compactName(g.name)
      return !!key && (key === compact || key.includes(compact) || compact.includes(key))
    })
  const links: Array<{ name: string; url: string; from: string; to: string }> = []
  for (const group of groups) {
    for (const link of group.links) {
      if (!keys.has(canonicalKey(link.url))) continue
      if (target && group.name === target.name) continue
      links.push({ name: link.name, url: link.url, from: group.name, to: target?.name || name })
    }
  }
  return { links, createdGroup: !target }
}

/**
 * 目录站点分类变更后，把导航池中同一网址的链接移动到对应分组。
 * 目标分组不存在时新建，保证两边分类一致。
 */
export async function syncNavCategoryFromDirectory(urls: string[], category: string): Promise<NavCategorySyncResult> {
  const name = String(category || '').trim()
  const keys = new Set(urls.map((url) => canonicalKey(url)).filter(Boolean))
  if (!name || !keys.size) return { moved: 0, createdGroup: false, category: name, links: [] }

  const current = await getSiteConfig({ fresh: true })
  const groups = (current.groups || []).map((g) => ({ ...g, links: [...(g.links || [])] }))
  const hasMatch = groups.some((g) => g.links.some((link) => keys.has(canonicalKey(link.url))))
  if (!hasMatch) return { moved: 0, createdGroup: false, category: name, links: [] }

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
  const links: Array<{ name: string; url: string; from: string; to: string }> = []
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
      links.push({ name: link.name, url: link.url, from: group.name, to: target.name })
      if (!target.links.some((item) => canonicalKey(item.url) === key)) target.links.push(link)
    }
    group.links = keep
  }
  if (!moved && !createdGroup) return { moved: 0, createdGroup: false, category: target.name, links: [] }

  const nextGroups = groups.filter((g) => g.links.length || g === target)
  await setSetting('site_config', {
    groups: nextGroups,
    recommended: Array.isArray(current.recommended) ? current.recommended : []
  })
  invalidateSiteConfig()
  await touchDirectoryCache()
  if (moved) {
    notifySearchUrls([
      ...new Set([
        ...links.map((item) => `/site?category=${encodeURIComponent(item.from)}`),
        `/site?category=${encodeURIComponent(target.name)}`
      ])
    ])
  }
  return { moved, createdGroup, category: target.name, links }
}
