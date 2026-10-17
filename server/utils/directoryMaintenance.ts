import { safeFetch } from './safeUrl'
import { fetchSiteMeta } from './site'
import { getSetting, setSetting } from './settings'
import { notifyAdmin } from './notify'

const LINK_TTL_DAYS = 7
const TDK_TTL_DAYS = 7
const LINK_CONCURRENCY = 4
const TDK_CONCURRENCY = 3
const BROKEN_FILTER = "status = 'published' AND http_status IS NOT NULL AND http_status >= 400 AND http_status NOT IN (401, 403, 429)"
const MISSING_FILTER = "status = 'published' AND (COALESCE(title, '') = '' OR COALESCE(description, '') = '')"

let running = false

export function isHealthyStatus(status: number): boolean {
  return status > 0 && (status < 400 || [401, 403, 429].includes(status))
}

export function isMaintenanceRunning(): boolean {
  return running
}

export async function checkLinksBatch(limit = 20): Promise<{
  checked: number
  healthy: number
  broken: number
  brokenItems: Array<{ id: number; name: string; url: string; status: number }>
  remaining: number
}> {
  const db = useDb()
  const size = Math.min(40, Math.max(1, limit))
  const [rows]: any = await db.query(
    `SELECT id, name, url FROM directory_entries
     WHERE status = 'published'
       AND (checked_at IS NULL OR checked_at < DATE_SUB(NOW(), INTERVAL ${LINK_TTL_DAYS} DAY))
     ORDER BY checked_at IS NULL DESC, checked_at ASC, id ASC LIMIT ${size}`
  )

  let healthy = 0
  const brokenItems: Array<{ id: number; name: string; url: string; status: number }> = []
  const run = async (row: any) => {
    const hit = await safeFetch(row.url, {
      timeout: 8000,
      maxRedirects: 4,
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    }).catch(() => null)
    const status = hit?.res.status || 0
    const finalUrl = String(hit?.finalUrl || '').slice(0, 500)
    if (hit?.res.body) await hit.res.body.cancel().catch(() => {})
    if (isHealthyStatus(status)) healthy++
    else brokenItems.push({ id: Number(row.id), name: String(row.name || ''), url: String(row.url || ''), status })
    await db.execute(
      'UPDATE directory_entries SET http_status = ?, final_url = ?, checked_at = NOW() WHERE id = ?',
      [status, finalUrl, row.id]
    )
  }
  for (let i = 0; i < rows.length; i += LINK_CONCURRENCY) {
    await Promise.all(rows.slice(i, i + LINK_CONCURRENCY).map(run))
  }

  const [[remain]]: any = await db.query(
    `SELECT COUNT(*) AS n FROM directory_entries
     WHERE status = 'published'
       AND (checked_at IS NULL OR checked_at < DATE_SUB(NOW(), INTERVAL ${LINK_TTL_DAYS} DAY))`
  )
  return {
    checked: rows.length,
    healthy,
    broken: brokenItems.length,
    brokenItems,
    remaining: Number(remain?.n || 0)
  }
}

export async function resetMissingTdk(): Promise<number> {
  const db = useDb()
  const [result]: any = await db.execute(
    `UPDATE directory_entries SET tdk_checked_at = NULL WHERE ${MISSING_FILTER}`
  )
  return Number(result?.affectedRows || 0)
}

export async function fillTdkBatch(limit = 6): Promise<{
  processed: number
  updated: number
  failed: number
  missing: number
  remaining: number
}> {
  const db = useDb()
  const size = Math.min(12, Math.max(1, limit))
  const [rows]: any = await db.query(
    `SELECT id, name, url, title, description, keywords, icon
     FROM directory_entries
     WHERE status = 'published'
       AND (tdk_checked_at IS NULL OR tdk_checked_at < DATE_SUB(NOW(), INTERVAL ${TDK_TTL_DAYS} DAY))
       AND (COALESCE(title, '') = '' OR COALESCE(description, '') = '')
     ORDER BY (COALESCE(description, '') = '') DESC, id ASC
     LIMIT ${size}`
  )

  let updated = 0
  let failed = 0
  const run = async (row: any) => {
    try {
      const meta = await fetchSiteMeta(row.url)
      if (!meta.title && !meta.description) {
        await db.execute('UPDATE directory_entries SET tdk_checked_at = NOW() WHERE id = ?', [row.id])
        failed++
        return
      }
      const title = row.title || meta.title || row.name
      const description = row.description || meta.description || ''
      const keywords = row.keywords || meta.keywords || ''
      const icon = row.icon || (/^https?:\/\//i.test(meta.icon) ? meta.icon : '')
      await db.execute(
        'UPDATE directory_entries SET title = ?, description = ?, keywords = ?, icon = ?, tdk_checked_at = NOW() WHERE id = ?',
        [String(title).slice(0, 200), String(description).slice(0, 500), String(keywords).slice(0, 300), String(icon).slice(0, 500), row.id]
      )
      updated++
    } catch {
      failed++
    }
  }
  for (let i = 0; i < rows.length; i += TDK_CONCURRENCY) {
    await Promise.all(rows.slice(i, i + TDK_CONCURRENCY).map(run))
  }

  const [[remain]]: any = await db.query(
    `SELECT COUNT(*) AS n FROM directory_entries
     WHERE status = 'published'
       AND (tdk_checked_at IS NULL OR tdk_checked_at < DATE_SUB(NOW(), INTERVAL ${TDK_TTL_DAYS} DAY))
       AND (COALESCE(title, '') = '' OR COALESCE(description, '') = '')`
  )
  const [[missing]]: any = await db.query(
    `SELECT COUNT(*) AS n FROM directory_entries WHERE ${MISSING_FILTER}`
  )
  return {
    processed: rows.length,
    updated,
    failed,
    missing: Number(missing?.n || 0),
    remaining: Number(remain?.n || 0)
  }
}

export async function getMaintenanceStatus(): Promise<any> {
  const db = useDb()
  const last = await getSetting<any>('directory_maintenance_last', null)
  const [[row]]: any = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(checked_at IS NULL OR checked_at < DATE_SUB(NOW(), INTERVAL ${LINK_TTL_DAYS} DAY)) AS due_links,
       SUM(http_status IS NOT NULL AND http_status >= 400 AND http_status NOT IN (401, 403, 429)) AS broken,
       SUM(COALESCE(title, '') = '' OR COALESCE(description, '') = '') AS missing,
       SUM((COALESCE(title, '') = '' OR COALESCE(description, '') = '')
         AND (tdk_checked_at IS NULL OR tdk_checked_at < DATE_SUB(NOW(), INTERVAL ${TDK_TTL_DAYS} DAY))) AS due_tdk
     FROM directory_entries WHERE status = 'published'`
  )
  return {
    schedule: '04:10',
    last: last || null,
    total: Number(row?.total || 0),
    dueLinks: Number(row?.due_links || 0),
    dueTdk: Number(row?.due_tdk || 0),
    broken: Number(row?.broken || 0),
    missing: Number(row?.missing || 0)
  }
}

async function brokenEntries(): Promise<Array<{ id: number; name: string; url: string; status: number }>> {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, name, url, http_status FROM directory_entries WHERE ${BROKEN_FILTER} ORDER BY id ASC`
  )
  return rows.map((row: any) => ({
    id: Number(row.id),
    name: String(row.name || ''),
    url: String(row.url || ''),
    status: Number(row.http_status || 0)
  }))
}

export async function runDirectoryMaintenance(options: { notifyNewBroken?: boolean } = {}): Promise<any> {
  if (running) throw createError({ statusCode: 409, statusMessage: '巡检正在进行，请稍后再试' })
  running = true
  const started = Date.now()
  try {
    const before = await brokenEntries()
    const beforeIds = new Set(before.map((item) => item.id))

    const link = { checked: 0, healthy: 0, broken: 0 }
    for (let i = 0; i < 20; i++) {
      const batch = await checkLinksBatch(20)
      link.checked += batch.checked
      link.healthy += batch.healthy
      link.broken += batch.broken
      if (!batch.checked || batch.remaining === 0) break
    }

    const tdk = { processed: 0, updated: 0, failed: 0 }
    for (let i = 0; i < 30; i++) {
      const batch = await fillTdkBatch(6)
      tdk.processed += batch.processed
      tdk.updated += batch.updated
      tdk.failed += batch.failed
      if (!batch.processed || batch.remaining === 0) break
    }

    const after = await brokenEntries()
    const newBroken = after.filter((item) => !beforeIds.has(item.id))
    const status = await getMaintenanceStatus()
    const record = {
      at: new Date().toISOString(),
      durationMs: Date.now() - started,
      link: { ...link, totalBroken: after.length },
      tdk: { ...tdk, missing: status.missing },
      newBroken
    }
    await setSetting('directory_maintenance_last', record)

    if (options.notifyNewBroken !== false && newBroken.length) {
      const names = newBroken.slice(0, 5).map((item) => `${item.name}(${item.status || '无法访问'})`).join('、')
      const suffix = newBroken.length > 5 ? ` 等 ${newBroken.length} 个` : ''
      await notifyAdmin(`目录巡检发现新异常：${names}${suffix}`, { newBroken: newBroken.length })
    }
    console.log(`[maintenance] 链接 ${link.checked} 个，异常 ${link.broken} 个；TDK 更新 ${tdk.updated} 个，缺失 ${status.missing} 个`)
    return record
  } finally {
    running = false
  }
}
