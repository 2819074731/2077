import { getSetting } from '../utils/settings'
import { isMaintenanceRunning, runDirectoryMaintenance } from '../utils/directoryMaintenance'

export default defineNitroPlugin(() => {
  if (!import.meta.server) return

  const tick = async () => {
    try {
      if (isMaintenanceRunning()) return
      const last = await getSetting<any>('directory_maintenance_last', null)
      const today = new Date().toDateString()
      const lastDay = last?.at ? new Date(String(last.at)).toDateString() : ''
      if (lastDay === today) return
      if (new Date().getHours() < 4) return
      await runDirectoryMaintenance()
    } catch (error: any) {
      if (Number(error?.statusCode) !== 409) console.warn('[maintenance] 自动巡检失败', error?.message || error)
    }
  }

  const initial = setTimeout(() => { void tick() }, 5 * 60 * 1000)
  initial.unref()
  const timer = setInterval(() => { void tick() }, 30 * 60 * 1000)
  timer.unref()
})
