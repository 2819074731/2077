const CHECK_INTERVAL = 60 * 1000
const COOLDOWN = 30 * 60 * 1000

function mb(value: number): number {
  return Math.round(value / 1024 / 1024)
}

export default defineNitroPlugin(() => {
  if (!import.meta.server) return

  const limit = Math.max(256, Number(process.env.MEMORY_ALERT_MB || 600))
  let lastAlert = 0
  let lastWarn = 0

  const timer = setInterval(() => {
    const usage = process.memoryUsage()
    const rss = mb(usage.rss)
    const heap = mb(usage.heapUsed)
    const now = Date.now()

    if (rss >= limit * 0.85 && now - lastWarn > 10 * 60 * 1000) {
      lastWarn = now
      console.warn(`[memory] RSS ${rss}MB / heap ${heap}MB，接近告警阈值 ${limit}MB`)
    }

    if (rss >= limit && now - lastAlert > COOLDOWN) {
      lastAlert = now
      void notifyAdmin(
        `[2077] 服务内存偏高：RSS ${rss}MB，heap ${heap}MB，阈值 ${limit}MB。PM2 将在 700MB 自动重启。`,
        { level: 'warning', rss, heap, limit, pid: process.pid }
      )
    }
  }, CHECK_INTERVAL)
  timer.unref()
})
