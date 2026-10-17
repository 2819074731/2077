import { normalizeSiteUrl } from '../../utils/site'
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
    const u = normalizeSiteUrl(sub.url)
    const url = u.toString()
    const cfg = await getSiteConfig()
    const groups = cfg.groups
    const target = String(body?.group || sub.grp || '').trim() || '收录站点'
    let grp = groups.find((g) => g.name === target)
    if (!grp) { grp = { name: target, links: [] }; groups.push(grp) }
    if (!grp.links.some((l) => l.url === url)) {
      grp.links.push({ name: sub.name, url, icon: `/api/icon?url=${encodeURIComponent(u.hostname)}` })
    }
    await setSetting('site_config', { groups, recommended: cfg.recommended })
    invalidateSiteConfig()
    await db.execute('UPDATE submissions SET status = ? WHERE id = ?', ['approved', id])
    return { ok: true, status: 'approved' }
  }

  throw createError({ statusCode: 400, statusMessage: '未知操作' })
})
