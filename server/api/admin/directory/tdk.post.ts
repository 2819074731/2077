import { fillTdkBatch, resetMissingTdk } from '../../../utils/directoryMaintenance'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const scope = ['all', 'category', 'batch'].includes(String(body?.scope))
    ? String(body.scope) as 'all' | 'category' | 'batch'
    : 'batch'
  const category = String(body?.category || '').trim().slice(0, 60)
  const limit = Math.max(1, Math.min(50, Number(body?.limit) || 6))
  if (scope === 'category' && !category) {
    throw createError({ statusCode: 400, statusMessage: '请选择要补全的分类' })
  }
  if (body?.reset === true) await resetMissingTdk(scope === 'category' ? category : undefined)
  const result = await fillTdkBatch(limit, scope === 'category' ? { category } : {})
  return { ok: true, scope, category, ...result }
})
