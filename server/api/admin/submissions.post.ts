import { normalizeSiteUrl } from '../../utils/site'
import { sanitizeDirectoryEntry } from '../../utils/directory'
import { cleanText, safeIcon } from '../../utils/sanitize'
import { getSiteConfig, invalidateSiteConfig } from '../../utils/siteConfig'
import { setSetting } from '../../utils/settings'
import { resolveSiteCategory } from '../../utils/categories'

function urlKey(input: string): string {
  try {
    const u = new URL(input)
    u.hash = ''
    return u.toString().replace(/\/+$/, '').toLowerCase()
  } catch {
    return ''
  }
}

function patchInput(body: any): any | null {
  return body?.data && typeof body.data === 'object' ? body.data : null
}

async function normalizePatch(body: any, current: any, normalizeCategory: boolean) {
  const input = patchInput(body)
  if (!input) return null

  const name = cleanText(input.name, 80)
  if (!name) throw createError({ statusCode: 400, statusMessage: '请填写站点名称' })
  const u = normalizeSiteUrl(String(input.url || ''))
  const icon = safeIcon(input.icon) || `/api/icon?url=${encodeURIComponent(u.hostname)}`
  const grp = normalizeCategory
    ? await resolveSiteCategory(input.grp || current.grp)
    : cleanText(input.grp ?? current.grp, 60)

  return {
    name,
    url: u.toString(),
    icon,
    title: cleanText(input.title, 200),
    description: cleanText(input.description, 500),
    keywords: cleanText(input.keywords, 300),
    grp
  }
}

async function assertUniqueUrl(url: string, id: number) {
  const db = useDb()
  const [dup]: any = await db.query(
    "SELECT id FROM submissions WHERE TRIM(TRAILING '/' FROM LOWER(url)) = ? AND id <> ? LIMIT 1",
    [urlKey(url), id]
  )
  if (dup.length) throw createError({ statusCode: 409, statusMessage: '该网址已在其他提交记录中' })
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

  if (action === 'update') {
    const patch = await normalizePatch(body, sub, true)
    if (!patch) throw createError({ statusCode: 400, statusMessage: '缺少修改内容' })
    await assertUniqueUrl(patch.url, id)
    await db.execute(
      `UPDATE submissions SET name = ?, url = ?, icon = ?, title = ?, description = ?, keywords = ?, grp = ?
       WHERE id = ?`,
      [patch.name, patch.url, patch.icon, patch.title, patch.description, patch.keywords, patch.grp, id]
    )
    return { ok: true, status: sub.status, category: patch.grp }
  }

  if (action === 'approve') {
    const targets = body?.targets && typeof body.targets === 'object' ? body.targets : null
    const legacyTarget = String(body?.target || sub.target || 'nav')
    const toNav = targets ? !!targets.nav : legacyTarget !== 'directory'
    const toDirectory = targets ? !!targets.directory : legacyTarget === 'directory' || legacyTarget === 'both'
    if (!toNav && !toDirectory) {
      throw createError({ statusCode: 400, statusMessage: '请至少选择一个收录位置' })
    }

    const patch = await normalizePatch(body, { ...sub, grp: body?.category || sub.grp }, true)
    const name = patch?.name || cleanText(sub.name, 80)
    const u = normalizeSiteUrl(patch?.url || sub.url)
    const url = u.toString()
    const key = urlKey(url)
    if (patch) await assertUniqueUrl(url, id)
    const category = patch?.grp || await resolveSiteCategory(body?.category || sub.grp)
    const icon = patch?.icon || safeIcon(sub.icon) || `/api/icon?url=${encodeURIComponent(u.hostname)}`
    const title = patch?.title ?? cleanText(sub.title, 200)
    const description = patch?.description ?? cleanText(sub.description, 500)
    const keywords = patch?.keywords ?? cleanText(sub.keywords, 300)

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
          name,
          url,
          icon,
          category,
          title,
          description,
          keywords,
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
        grp.links.push({ name, url, icon })
        await setSetting('site_config', { groups, recommended: cfg.recommended })
        invalidateSiteConfig()
        result.nav = 'created'
      }
    }

    result.target = toNav && toDirectory ? 'both' : toNav ? 'nav' : 'directory'
    await db.execute(
      `UPDATE submissions SET name = ?, url = ?, icon = ?, title = ?, description = ?, keywords = ?,
         status = 'approved', target = ?, grp = ? WHERE id = ?`,
      [name, url, icon, title, description, keywords, result.target, category, id]
    )
    return result
  }

  throw createError({ statusCode: 400, statusMessage: '未知操作' })
})
