import { urlKey } from '#shared/nav'
import { getSiteCategories, isProtectedCategory, saveSiteCategories } from '../../../utils/categories'
import { getSiteConfig, invalidateSiteConfig } from '../../../utils/siteConfig'
import { setSetting } from '../../../utils/settings'
import { cleanText } from '../../../utils/sanitize'

async function usage(name: string): Promise<{ directory: number; nav: number; submissions: number }> {
  const db = useDb()
  const [[directory]]: any = await db.query('SELECT COUNT(*) AS n FROM directory_entries WHERE category = ?', [name])
  const [[submissions]]: any = await db.query('SELECT COUNT(*) AS n FROM submissions WHERE grp = ?', [name])
  const cfg = await getSiteConfig()
  const nav = cfg.groups.find((g) => g.name === name)?.links.length || 0
  return {
    directory: Number(directory?.n || 0),
    nav,
    submissions: Number(submissions?.n || 0)
  }
}

async function syncNavOrder(categories: string[]): Promise<void> {
  const cfg = await getSiteConfig()
  const rank = new Map(categories.map((name, i) => [name, i]))
  const groups = [...cfg.groups].sort((a, b) => {
    const ai = rank.has(a.name) ? rank.get(a.name)! : categories.length
    const bi = rank.has(b.name) ? rank.get(b.name)! : categories.length
    return ai - bi
  })
  if (groups.every((g, i) => g.name === cfg.groups[i]?.name)) return
  await setSetting('site_config', { groups, recommended: cfg.recommended })
  invalidateSiteConfig()
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const action = String(body?.action || '')

  if (action === 'add') {
    const name = cleanText(body?.name, 30)
    if (!name) throw createError({ statusCode: 400, statusMessage: '请填写分类名称' })
    const categories = await getSiteCategories()
    if (categories.includes(name)) {
      throw createError({ statusCode: 409, statusMessage: '该分类已存在' })
    }
    const used = await usage(name)
    if (used.directory + used.nav + used.submissions > 0) {
      throw createError({ statusCode: 409, statusMessage: '已有同名分类数据，请直接使用现有分类' })
    }
    categories.push(name)
    const saved = await saveSiteCategories(categories)
    return { ok: true, categories: saved }
  }

  if (action === 'rename') {
    const from = cleanText(body?.from, 30)
    const to = cleanText(body?.to, 30)
    if (!from || !to) throw createError({ statusCode: 400, statusMessage: '分类名称不能为空' })
    if (from === to) return { ok: true }
    if (isProtectedCategory(from)) {
      throw createError({ statusCode: 400, statusMessage: '「其他」为系统保留分类，不能重命名' })
    }

    const categories = await getSiteCategories()
    if (categories.includes(to)) {
      throw createError({ statusCode: 409, statusMessage: '目标分类已存在' })
    }

    const db = useDb()
    await db.execute('UPDATE directory_entries SET category = ? WHERE category = ?', [to, from])
    await db.execute('UPDATE submissions SET grp = ? WHERE grp = ?', [to, from])

    const cfg = await getSiteConfig()
    const oldGroup = cfg.groups.find((g) => g.name === from)
    if (oldGroup) {
      const target = cfg.groups.find((g) => g.name === to)
      if (target) {
        const seen = new Set(target.links.map((l) => urlKey(l.url)))
        for (const link of oldGroup.links) {
          const key = urlKey(link.url)
          if (!key || seen.has(key)) continue
          seen.add(key)
          target.links.push(link)
        }
        cfg.groups = cfg.groups.filter((g) => g !== oldGroup)
      } else {
        oldGroup.name = to
      }
      await setSetting('site_config', { groups: cfg.groups, recommended: cfg.recommended })
      invalidateSiteConfig()
    }

    const next = (categories.includes(from)
      ? categories.map((name) => name === from ? to : name)
      : [...categories, to])
    const saved = await saveSiteCategories(next)
    return { ok: true, categories: saved }
  }

  if (action === 'delete') {
    const name = cleanText(body?.name, 30)
    if (!name) throw createError({ statusCode: 400, statusMessage: '缺少分类名称' })
    if (isProtectedCategory(name)) {
      throw createError({ statusCode: 400, statusMessage: '「其他」为系统保留分类，不能删除' })
    }

    const used = await usage(name)
    const total = used.directory + used.nav + used.submissions
    if (total > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `该分类下还有 ${total} 条数据（目录 ${used.directory}、导航 ${used.nav}、提交 ${used.submissions}），请先迁移或删除`
      })
    }

    const cfg = await getSiteConfig()
    const groups = cfg.groups.filter((g) => g.name !== name)
    if (groups.length !== cfg.groups.length) {
      await setSetting('site_config', { groups, recommended: cfg.recommended })
      invalidateSiteConfig()
    }

    const categories = await getSiteCategories()
    const saved = await saveSiteCategories(categories.filter((item) => item !== name))
    return { ok: true, categories: saved }
  }

  if (action === 'move') {
    const name = cleanText(body?.name, 30)
    const dir = Number(body?.dir) < 0 ? -1 : 1
    if (!name) throw createError({ statusCode: 400, statusMessage: '缺少分类名称' })
    const categories = await getSiteCategories()
    const index = categories.indexOf(name)
    if (index < 0) throw createError({ statusCode: 404, statusMessage: '分类不存在' })
    const next = index + dir
    if (next < 0 || next >= categories.length) return { ok: true, categories }
    const [item] = categories.splice(index, 1)
    categories.splice(next, 0, item)
    const saved = await saveSiteCategories(categories)
    await syncNavOrder(saved)
    return { ok: true, categories: saved }
  }

  throw createError({ statusCode: 400, statusMessage: '未知操作' })
})
