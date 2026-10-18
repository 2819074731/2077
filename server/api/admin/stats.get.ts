import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getSetting } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const [[users]]: any = await db.query('SELECT COUNT(*) AS n FROM users')
  const [[links]]: any = await db.query('SELECT COUNT(*) AS n FROM user_links')
  const [[pending]]: any = await db.query("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending'")
  const [[approved]]: any = await db.query("SELECT COUNT(*) AS n FROM submissions WHERE status = 'approved'")
  const [[directory]]: any = await db.query("SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published'")
  const [[traffic]]: any = await db.query(
    `SELECT SUM(is_bot = 0) AS pv, COUNT(DISTINCT CASE WHEN is_bot = 0 THEN visitor END) AS uv, SUM(is_bot = 1) AS bot
     FROM traffic_log WHERE day = CURDATE()`
  )
  const [[autoHidden]]: any = await db.query(
    "SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published' AND health_hidden = 1"
  )
  const [[navBroken]]: any = await db.query(
    `SELECT COUNT(*) AS n FROM link_health
     WHERE status = 0 OR (status >= 400 AND status NOT IN (401, 403, 412, 429))`
  )
  const [[zeroToday]]: any = await db.query(
    'SELECT COUNT(*) AS n FROM search_events WHERE results = 0 AND created_at >= CURDATE()'
  )
  const [recent]: any = await db.query(
    'SELECT id, name, url, status, created_at FROM submissions ORDER BY id DESC LIMIT 8'
  )

  let backup: { name: string; at: number; ageHours: number } | null = null
  try {
    const dir = process.env.BACKUP_DIR || '/www/backup/my2077'
    const files = (await readdir(dir)).filter((name) => /^db-.*\.sql\.gz$/.test(name))
    for (const name of files) {
      const info = await stat(join(dir, name))
      if (!backup || info.mtimeMs > backup.at) backup = { name, at: info.mtimeMs, ageHours: 0 }
    }
    if (backup) backup.ageHours = Math.round((Date.now() - backup.at) / 3600000)
  } catch {
    backup = null
  }

  const maintenance = await getSetting<any>('directory_maintenance_last', null)

  return {
    stats: {
      users: users.n,
      links: links.n,
      pending: pending.n,
      approved: approved.n,
      directory: directory.n,
      todayPv: Number(traffic?.pv || 0),
      todayUv: Number(traffic?.uv || 0),
      todayBot: Number(traffic?.bot || 0)
    },
    todo: {
      pending: Number(pending.n || 0),
      autoHidden: Number(autoHidden?.n || 0),
      navBroken: Number(navBroken?.n || 0),
      zeroToday: Number(zeroToday?.n || 0),
      maintenanceAt: maintenance?.at || null,
      backup
    },
    recent
  }
})
