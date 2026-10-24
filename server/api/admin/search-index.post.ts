import { rebuildSiteSearchIndex } from '../../utils/siteSearch'
import { logAdmin } from '../../utils/adminLog'

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const action = String(body?.action || 'rebuild')
  if (action !== 'rebuild') throw createError({ statusCode: 400, statusMessage: '未知操作' })
  const status = await rebuildSiteSearchIndex(useDb())
  await logAdmin(event, user, '搜索索引重建', 'site-search', { directory: status.directory, aliases: status.aliases, durationMs: status.durationMs })
  return { ok: true, status }
})
