import { ENGINES } from '#shared/nav'
import { getHotSearch, getHotSearchStatuses } from '../../utils/hotSearch'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => null)
  const id = String(body?.engine ?? '').toLowerCase()
  if (!ENGINES.some(e => e.id === id)) {
    throw createError({ statusCode: 400, statusMessage: '未知的搜索引擎' })
  }
  await getHotSearch(id, true)
  return { statuses: getHotSearchStatuses([id]) }
})
