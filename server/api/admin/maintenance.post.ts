import { isMaintenanceRunning, resetMissingTdk, runDirectoryMaintenance } from '../../utils/directoryMaintenance'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  if (isMaintenanceRunning()) {
    throw createError({ statusCode: 409, statusMessage: '巡检正在进行，请稍后再试' })
  }
  await resetMissingTdk()
  const record = await runDirectoryMaintenance({ notifyNewBroken: false })
  return { ok: true, record }
})
