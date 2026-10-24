export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const days = Math.min(90, Math.max(1, Number(q.days) || 14))
  const db = useDb()

  const [[total]]: any = await db.query(
    'SELECT COUNT(*) AS n FROM search_events WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)',
    [days - 1]
  )
  const [[today]]: any = await db.query(
    'SELECT COUNT(*) AS n FROM search_events WHERE created_at >= CURDATE()'
  )
  const [engines]: any = await db.query(
    `SELECT engine, COUNT(*) AS n FROM search_events
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY engine ORDER BY n DESC LIMIT 20`,
    [days - 1]
  )
  const [terms]: any = await db.query(
    `SELECT term, COUNT(*) AS n FROM search_events
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY term ORDER BY n DESC LIMIT 30`,
    [days - 1]
  )
  const [[tracked]]: any = await db.query(
    `SELECT COUNT(*) AS n FROM search_events
     WHERE results IS NOT NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [days - 1]
  )
  const [[zero]]: any = await db.query(
    `SELECT COUNT(*) AS n FROM search_events
     WHERE results = 0 AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [days - 1]
  )
  const [zeroTerms]: any = await db.query(
    `SELECT term, COUNT(*) AS n, MAX(created_at) AS last_at FROM search_events
     WHERE results = 0 AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY term ORDER BY n DESC, last_at DESC LIMIT 20`,
    [days - 1]
  )
  const [kinds]: any = await db.query(
    `SELECT kind, COUNT(*) AS n FROM search_events
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY kind`
  , [days - 1])
  const [[site]]: any = await db.query(
    `SELECT
       SUM(kind = 'input') AS searches,
       SUM(kind = 'result_click') AS clicks
     FROM search_events
     WHERE engine = 'site' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [days - 1]
  )
  let avgTook = 0
  let p95Took = 0
  let maxTook = 0
  try {
    const [tookRows]: any = await db.query(
      `SELECT took_ms FROM search_events
       WHERE engine = 'site' AND kind = 'input' AND took_ms IS NOT NULL
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY id DESC LIMIT 2000`,
      [days - 1]
    )
    const values = tookRows
      .map((row: any) => Number(row.took_ms))
      .filter((n: number) => Number.isFinite(n) && n >= 0)
      .sort((a: number, b: number) => a - b)
    if (values.length) {
      avgTook = Math.round(values.reduce((sum: number, n: number) => sum + n, 0) / values.length)
      p95Took = values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * 0.95) - 1))]
      maxTook = values[values.length - 1]
    }
  } catch {}
  const siteSearches = Number(site?.searches || 0)
  const siteClicks = Number(site?.clicks || 0)
  const [dailyRows]: any = await db.query(
    `SELECT DATE(created_at) AS d, COUNT(*) AS n FROM search_events
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at) ORDER BY d ASC`,
    [days - 1]
  )
  const dailyMap = new Map<string, number>()
  for (const r of dailyRows) dailyMap.set(localDayKey(r.d), Number(r.n || 0))
  const daily: any[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = localDayKey(d)
    daily.push({ d: key, n: dailyMap.get(key) || 0 })
  }

  return {
    days,
    summary: {
      total: Number(total?.n || 0),
      today: Number(today?.n || 0),
      tracked: Number(tracked?.n || 0),
      zero: Number(zero?.n || 0),
      site: siteSearches,
      siteClicks,
      ctr: siteSearches ? Math.round(siteClicks / siteSearches * 1000) / 10 : 0,
      avgTook,
      p95Took,
      maxTook
    },
    engines,
    terms,
    zeroTerms,
    kinds,
    daily
  }
})
