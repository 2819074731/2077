import { fillTdkBatch, resetMissingTdk } from '../../../utils/directoryMaintenance'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const limit = Math.max(1, Math.min(12, Number(body?.limit) || 6))
  if (body?.reset === true) await resetMissingTdk()
  const result = await fillTdkBatch(limit)
  return { ok: true, ...result }
})
