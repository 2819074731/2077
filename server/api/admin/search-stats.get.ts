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
      zero: Number(zero?.n || 0)
    },
    engines,
    terms,
    zeroTerms,
    kinds,
    daily
  }
})
