export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const days = Math.min(90, Math.max(1, Number(q.days) || 14))
  const offset = days - 1
  const db = useDb()

  const [
    [dailyRows],
    [[today]],
    [[total]],
    [topPages],
    [referers],
    [devices],
    [bots],
    [botPaths],
    [recentBots],
    [hourlyRows],
    [statusRows],
    [[clicksTotal]],
    [[clicksToday]],
    [clickDaily],
    [searchRows],
    [[realtime]],
    [topClicks]
  ]: any = await Promise.all([
    db.query(
      `SELECT day,
              SUM(is_bot = 0) AS pv,
              COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv,
              SUM(is_bot = 1) AS bot
       FROM traffic_log
       WHERE day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY day ORDER BY day ASC`,
      [offset]
    ),
    db.query(
      `SELECT SUM(is_bot = 0) AS pv,
              COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv,
              SUM(is_bot = 1) AS bot
       FROM traffic_log WHERE day = CURDATE()`
    ),
    db.query(
      `SELECT SUM(is_bot = 0) AS pv,
              COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv,
              SUM(is_bot = 1) AS bot
       FROM traffic_log`
    ),
    db.query(
      `SELECT path, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv
       FROM traffic_log WHERE is_bot = 0 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY path ORDER BY pv DESC LIMIT 30`,
      [offset]
    ),
    db.query(
      `SELECT referer, COUNT(*) AS n FROM traffic_log
       WHERE is_bot = 0 AND referer <> '' AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY referer ORDER BY n DESC LIMIT 15`,
      [offset]
    ),
    db.query(
      `SELECT device, COUNT(*) AS n FROM traffic_log
       WHERE is_bot = 0 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY device ORDER BY n DESC`,
      [offset]
    ),
    db.query(
      `SELECT bot, COUNT(*) AS hits, COUNT(DISTINCT ip_hash) AS ips, MAX(created_at) AS last_at
       FROM traffic_log WHERE is_bot = 1 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY bot ORDER BY hits DESC LIMIT 30`,
      [offset]
    ),
    db.query(
      `SELECT path, bot, COUNT(*) AS n FROM traffic_log
       WHERE is_bot = 1 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY path, bot ORDER BY n DESC LIMIT 30`,
      [offset]
    ),
    db.query(
      `SELECT bot, path, ua, status, created_at FROM traffic_log
       WHERE is_bot = 1 ORDER BY id DESC LIMIT 30`
    ),
    db.query(
      `SELECT HOUR(created_at) AS h,
              SUM(is_bot = 0) AS pv,
              COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv,
              SUM(is_bot = 1) AS bot
       FROM traffic_log WHERE day = CURDATE()
       GROUP BY h ORDER BY h ASC`
    ),
    db.query(
      `SELECT status, COUNT(*) AS n FROM traffic_log
       WHERE is_bot = 0 AND status >= 400 AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY status ORDER BY n DESC LIMIT 12`,
      [offset]
    ),
    db.query('SELECT COUNT(*) AS n FROM link_clicks'),
    db.query('SELECT COUNT(*) AS n FROM link_clicks WHERE created_at >= CURDATE()'),
    db.query(
      `SELECT DATE(created_at) AS d, COUNT(*) AS n FROM link_clicks
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY d ASC`,
      [offset]
    ),
    db.query(
      `SELECT COUNT(*) AS total,
              SUM(kind = 'input') AS searches,
              SUM(results IS NOT NULL) AS tracked,
              SUM(results = 0) AS zero,
              SUM(engine = 'site' AND kind = 'result_click') AS site_clicks,
              SUM(engine = 'github') AS github,
              SUM(engine = 'google') AS google
       FROM search_events
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [offset]
    ),
    db.query(
      `SELECT SUM(is_bot = 0) AS pv,
              COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv,
              SUM(is_bot = 1) AS bot
       FROM traffic_log WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
    ),
    db.query('SELECT url, name, hits FROM link_click_agg ORDER BY hits DESC LIMIT 10')
  ])

  const map = new Map<string, any>()
  for (const r of dailyRows) {
    const key = localDayKey(r.day)
    map.set(key, { pv: Number(r.pv || 0), uv: Number(r.uv || 0), bot: Number(r.bot || 0) })
  }
  const clickMap = new Map<string, number>()
  for (const r of clickDaily) clickMap.set(localDayKey(r.d), Number(r.n || 0))

  const daily: any[] = []
  for (let i = offset; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = localDayKey(d)
    daily.push({ d: key, ...(map.get(key) || { pv: 0, uv: 0, bot: 0 }), clicks: clickMap.get(key) || 0 })
  }

  const hourly = Array.from({ length: 24 }, (_, h) => {
    const row = hourlyRows.find((r: any) => Number(r.h) === h)
    return {
      h,
      pv: Number(row?.pv || 0),
      uv: Number(row?.uv || 0),
      bot: Number(row?.bot || 0)
    }
  })

  const search = searchRows?.[0] || {}
  const searches = Number(search.searches || 0)
  const zero = Number(search.zero || 0)
  const tracked = Number(search.tracked || 0)
  const siteClicks = Number(search.site_clicks || 0)

  setHeader(event, 'Cache-Control', 'private, max-age=30')

  return {
    days,
    summary: {
      today: { pv: Number(today?.pv || 0), uv: Number(today?.uv || 0), bot: Number(today?.bot || 0) },
      total: { pv: Number(total?.pv || 0), uv: Number(total?.uv || 0), bot: Number(total?.bot || 0) },
      realtime: { pv: Number(realtime?.pv || 0), uv: Number(realtime?.uv || 0), bot: Number(realtime?.bot || 0) },
      clicks: { total: Number(clicksTotal?.n || 0), today: Number(clicksToday?.n || 0) },
      search: {
        total: Number(search.total || 0),
        searches,
        tracked,
        zero,
        zeroRate: tracked ? Math.round((zero / tracked) * 1000) / 10 : 0,
        github: Number(search.github || 0),
        google: Number(search.google || 0),
        siteClicks,
        ctr: searches ? Math.round((siteClicks / searches) * 1000) / 10 : 0
      }
    },
    daily,
    hourly,
    topPages,
    referers,
    devices,
    bots,
    botPaths,
    recentBots,
    statuses: statusRows.map((r: any) => ({ status: Number(r.status || 0), n: Number(r.n || 0) })),
    topClicks
  }
})
