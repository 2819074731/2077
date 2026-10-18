import { searchGithub } from '../utils/github'

const START_DELAY = 120_000
const INTERVAL = 30 * 60 * 1000
const LIMIT = 6

let running = false

async function warmOnce(): Promise<void> {
  if (running) return
  running = true
  try {
    const db = useDb()
    const [rows]: any = await db.query(
      `SELECT term, COUNT(*) AS n FROM search_events
       WHERE engine = 'github' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND CHAR_LENGTH(term) BETWEEN 2 AND 60
       GROUP BY term HAVING n >= 2
       ORDER BY n DESC, MAX(created_at) DESC LIMIT ?`,
      [LIMIT]
    )
    let warmed = 0
    for (const row of rows) {
      const term = String(row?.term || '').trim()
      if (!term) continue
      try {
        await searchGithub(term, 1, 'best')
        warmed++
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
    if (warmed) console.log(`[github-prewarm] 已预热 ${warmed} 个热门搜索词`)
  } catch (error: any) {
    console.warn('[github-prewarm] 预热失败', error?.message || error)
  } finally {
    running = false
  }
}

export default defineNitroPlugin(() => {
  if (!import.meta.server) return
  const initial = setTimeout(() => { void warmOnce() }, START_DELAY)
  initial.unref()
  const timer = setInterval(() => { void warmOnce() }, INTERVAL)
  timer.unref()
})
