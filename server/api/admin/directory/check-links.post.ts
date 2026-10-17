import { checkLinksBatch } from '../../../utils/directoryMaintenance'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const limit = Math.max(1, Math.min(20, Number(body?.limit) || 8))
  const result = await checkLinksBatch(limit)
  return {
    ok: true,
    checked: result.checked,
    healthy: result.healthy,
    broken: result.broken,
    remaining: result.remaining
  }
})
