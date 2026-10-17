import { normalizeSiteUrl } from '../../utils/site'
import { sanitizeDirectoryEntry } from '../../utils/directory'
import { getSiteConfig, invalidateSiteConfig } from '../../utils/siteConfig'
import { setSetting } from '../../utils/settings'

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
    const target = String(body?.target || sub.target || 'nav') === 'directory' ? 'directory' : 'nav'
    if (target === 'directory') {
      const e = sanitizeDirectoryEntry({
        name: sub.name,
        url: sub.url,
        icon: sub.icon,
        category: body?.category || sub.grp || '其他',
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
        await db.execute("UPDATE submissions SET status = 'approved', target = 'directory' WHERE id = ?", [id])
        return { ok: true, status: 'approved', target, id: Number(r.insertId) }
      } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate entry')) {
          throw createError({ statusCode: 409, statusMessage: '目录中已存在该网址' })
        }
        throw err
      }
    }
    const u = normalizeSiteUrl(sub.url)
    const url = u.toString()
    const cfg = await getSiteConfig()
    const groups = cfg.groups
    const groupName = String(body?.group || sub.grp || '').trim() || '收录站点'
    let grp = groups.find((g) => g.name === groupName)
    if (!grp) { grp = { name: groupName, links: [] }; groups.push(grp) }
    if (!grp.links.some((l) => l.url === url)) {
      grp.links.push({ name: sub.name, url, icon: `/api/icon?url=${encodeURIComponent(u.hostname)}` })
    }
    await setSetting('site_config', { groups, recommended: cfg.recommended })
    invalidateSiteConfig()
    await db.execute("UPDATE submissions SET status = 'approved', target = 'nav' WHERE id = ?", [id])
    return { ok: true, status: 'approved', target: 'nav' }
  }

  throw createError({ statusCode: 400, statusMessage: '未知操作' })
})
