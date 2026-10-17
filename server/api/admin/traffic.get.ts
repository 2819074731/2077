export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const days = Math.min(90, Math.max(1, Number(q.days) || 14))
  const db = useDb()

  const [rows]: any = await db.query(
    `SELECT day,
            SUM(is_bot = 0) AS pv,
            COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv,
            SUM(is_bot = 1) AS bot
     FROM traffic_log
     WHERE day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY day ORDER BY day ASC`,
    [days - 1]
  )
  const map = new Map<string, any>()
  for (const r of rows) {
    const key = localDayKey(r.day)
    map.set(key, { pv: Number(r.pv || 0), uv: Number(r.uv || 0), bot: Number(r.bot || 0) })
  }
  const daily: any[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = localDayKey(d)
    daily.push({ d: key, ...(map.get(key) || { pv: 0, uv: 0, bot: 0 }) })
  }

  const [[today]]: any = await db.query(
    `SELECT SUM(is_bot = 0) AS pv,
            COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv,
            SUM(is_bot = 1) AS bot
     FROM traffic_log WHERE day = CURDATE()`
  )
  const [[total]]: any = await db.query(
    `SELECT SUM(is_bot = 0) AS pv,
            COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv,
            SUM(is_bot = 1) AS bot
     FROM traffic_log`
  )

  const [topPages]: any = await db.query(
    `SELECT path, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv
     FROM traffic_log WHERE is_bot = 0 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY path ORDER BY pv DESC LIMIT 30`,
    [days - 1]
  )
  const [referers]: any = await db.query(
    `SELECT referer, COUNT(*) AS n FROM traffic_log
     WHERE is_bot = 0 AND referer <> '' AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY referer ORDER BY n DESC LIMIT 15`,
    [days - 1]
  )
  const [devices]: any = await db.query(
    `SELECT device, COUNT(*) AS n FROM traffic_log
     WHERE is_bot = 0 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY device ORDER BY n DESC`,
    [days - 1]
  )
  const [bots]: any = await db.query(
    `SELECT bot, COUNT(*) AS hits, COUNT(DISTINCT ip_hash) AS ips, MAX(created_at) AS last_at
     FROM traffic_log WHERE is_bot = 1 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY bot ORDER BY hits DESC LIMIT 30`,
    [days - 1]
  )
  const [botPaths]: any = await db.query(
    `SELECT path, bot, COUNT(*) AS n FROM traffic_log
     WHERE is_bot = 1 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY path, bot ORDER BY n DESC LIMIT 30`,
    [days - 1]
  )
  const [recentBots]: any = await db.query(
    `SELECT bot, path, ua, status, created_at FROM traffic_log
     WHERE is_bot = 1 ORDER BY id DESC LIMIT 30`
  )

  const [[clicksTotal]]: any = await db.query('SELECT COUNT(*) AS n FROM link_clicks')
  const [[clicksToday]]: any = await db.query(
    'SELECT COUNT(*) AS n FROM link_clicks WHERE created_at >= CURDATE()'
  )
  const [clickDaily]: any = await db.query(
    `SELECT DATE(created_at) AS d, COUNT(*) AS n FROM link_clicks
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at) ORDER BY d ASC`,
    [days - 1]
  )
  const clickMap = new Map<string, number>()
  for (const r of clickDaily) {
    const key = localDayKey(r.d)
    clickMap.set(key, Number(r.n || 0))
  }
  for (const d of daily) d.clicks = clickMap.get(d.d) || 0

  return {
    days,
    summary: {
      today: { pv: Number(today?.pv || 0), uv: Number(today?.uv || 0), bot: Number(today?.bot || 0) },
      total: { pv: Number(total?.pv || 0), uv: Number(total?.uv || 0), bot: Number(total?.bot || 0) },
      clicks: { total: Number(clicksTotal?.n || 0), today: Number(clicksToday?.n || 0) }
    },
    daily,
    topPages,
    referers,
    devices,
    bots,
    botPaths,
    recentBots
  }
})
