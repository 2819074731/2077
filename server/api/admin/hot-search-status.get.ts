import { ENGINES } from '#shared/nav'
import { getHotSearchStatuses } from '../../utils/hotSearch'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = getHotSearchStatuses(ENGINES.map(e => e.id))
  const nameMap = new Map(ENGINES.map(e => [e.id, e.name]))
  return {
    engines: rows.map(r => ({ ...r, name: nameMap.get(r.engine) || r.engine })),
    at: Date.now()
  }
})
