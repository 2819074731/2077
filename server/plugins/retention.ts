const BATCH_SIZE = 1000
const MAX_BATCHES = 100

async function purge(label: string, sql: string, params: any[]): Promise<void> {
  const db = useDb()
  let total = 0
  try {
    for (let i = 0; i < MAX_BATCHES; i++) {
      const [result]: any = await db.execute(sql, params)
      const affected = Number(result?.affectedRows || 0)
      total += affected
      if (affected < BATCH_SIZE) break
    }
    if (total > 0) console.log(`[retention] ${label}: 清理 ${total} 行`)
  } catch (error) {
    console.error(`[retention] ${label}: 清理失败`, error)
  }
}

async function runCleanup(reason: string): Promise<void> {
  try {
    console.log(`[retention] 开始清理（${reason}）`)
    await purge('link_clicks', 'DELETE FROM link_clicks WHERE created_at < NOW() - INTERVAL 90 DAY LIMIT 1000', [])
    await purge('search_events', 'DELETE FROM search_events WHERE created_at < NOW() - INTERVAL 180 DAY LIMIT 1000', [])
    await purge('search_events', 'DELETE FROM search_events WHERE created_at < NOW() - INTERVAL 180 DAY LIMIT 1000', [])
    await purge('traffic_log', 'DELETE FROM traffic_log WHERE created_at < NOW() - INTERVAL 180 DAY LIMIT 1000', [])
    await purge('rate_limits', 'DELETE FROM rate_limits WHERE reset_at < ? LIMIT 1000', [Date.now()])
  } catch (error) {
    console.error('[retention] 清理任务异常', error)
  }
}

export default defineNitroPlugin(() => {
  if (!import.meta.server) return

  const initial = setTimeout(() => {
    void runCleanup('startup')
  }, 60_000)
  initial.unref()

  const daily = setInterval(() => {
    void runCleanup('daily')
  }, 24 * 60 * 60 * 1000)
  daily.unref()
})
