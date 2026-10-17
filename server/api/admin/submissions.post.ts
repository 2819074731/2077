import { normalizeSiteUrl } from '../../utils/site'
import { sanitizeDirectoryEntry } from '../../utils/directory'
import { safeIcon } from '../../utils/sanitize'
import { getSiteConfig, invalidateSiteConfig } from '../../utils/siteConfig'
import { setSetting } from '../../utils/settings'
import { DEFAULT_CATEGORY, isSiteCategory } from '#shared/categories'

function urlKey(input: string): string {
  try {
    const u = new URL(input)
    u.hash = ''
    return u.toString().replace(/\/+$/, '').toLowerCase()
  } catch {
    return ''
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const id = Number(body?.id)
  const action = String(body?.action || '')

  const db = useDb()
  const [rows]: any = await db.query('SELECT * FROM submissions WHERE id = ? LIMIT 1', [id])
  const sub = rows[0]
  if (!sub) throw createError({ statusCode: 404, statusMessage: '提交记录不存在' })

  if (action === 'reject') {
    await db.execute('UPDATE submissions SET status = ? WHERE id = ?', ['rejected', id])
    return { ok: true, status: 'rejected' }
  }

  if (action === 'approve') {
    const targets = body?.targets && typeof body.targets === 'object' ? body.targets : null
    const legacyTarget = String(body?.target || sub.target || 'nav')
    const toNav = targets ? !!targets.nav : legacyTarget !== 'directory'
    const toDirectory = targets ? !!targets.directory : legacyTarget === 'directory' || legacyTarget === 'both'
    if (!toNav && !toDirectory) {
      throw createError({ statusCode: 400, statusMessage: '请至少选择一个收录位置' })
    }

    const requested = String(body?.category || body?.group || sub.grp || '').trim()
    const category = isSiteCategory(requested)
      ? requested
      : isSiteCategory(sub.grp)
        ? sub.grp
        : DEFAULT_CATEGORY

    const u = normalizeSiteUrl(sub.url)
    const url = u.toString()
    const key = urlKey(url)
    const icon = safeIcon(sub.icon) || `/api/icon?url=${encodeURIComponent(u.hostname)}`
    const result: {
      ok: boolean
      status: string
      target: string
      category: string
      nav: 'skipped' | 'created' | 'exists'
      directory: 'skipped' | 'created' | 'exists'
      directoryId?: number
    } = {
      ok: true,
      status: 'approved',
      target: '',
      category,
      nav: 'skipped',
      directory: 'skipped'
    }

    if (toDirectory) {
      const [existing]: any = await db.query(
        "SELECT id FROM directory_entries WHERE TRIM(TRAILING '/' FROM LOWER(url)) = ? LIMIT 1",
        [key]
      )
      if (existing.length) {
        result.directory = 'exists'
        result.directoryId = Number(existing[0].id)
      } else {
        const e = sanitizeDirectoryEntry({
          name: sub.name,
          url,
          icon: sub.icon,
          category,
          title: sub.title,
          description: sub.description,
          keywords: sub.keywords,
          status: 'published'
        })
        try {
          const [r]: any = await db.execute(
            `INSERT INTO directory_entries (name, url, icon, category, title, description, keywords, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'published')`,
            [e.name, e.url, e.icon, e.category, e.title, e.description, e.keywords]
          )
          result.directory = 'created'
          result.directoryId = Number(r.insertId)
        } catch (err: any) {
          if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate entry')) {
            const [dup]: any = await db.query(
              "SELECT id FROM directory_entries WHERE TRIM(TRAILING '/' FROM LOWER(url)) = ? LIMIT 1",
              [key]
            )
            result.directory = 'exists'
            if (dup.length) result.directoryId = Number(dup[0].id)
          } else {
            throw err
          }
        }
      }
    }

    if (toNav) {
      const cfg = await getSiteConfig()
      const groups = cfg.groups
      let grp = groups.find((g) => g.name === category)
      if (!grp) {
        grp = { name: category, links: [] }
        groups.push(grp)
      }
      if (grp.links.some((l) => urlKey(l.url) === key)) {
        result.nav = 'exists'
      } else {
        grp.links.push({ name: sub.name, url, icon })
        await setSetting('site_config', { groups, recommended: cfg.recommended })
        invalidateSiteConfig()
        result.nav = 'created'
      }
    }

    result.target = toNav && toDirectory ? 'both' : toNav ? 'nav' : 'directory'
    await db.execute("UPDATE submissions SET status = 'approved', target = ?, grp = ? WHERE id = ?", [
      result.target,
      category,
      id
    ])
    return result
  }

  throw createError({ statusCode: 400, statusMessage: '未知操作' })
})
