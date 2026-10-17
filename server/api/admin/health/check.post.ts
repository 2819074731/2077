import { createHash } from 'node:crypto'
import { getSiteConfig } from '../../../utils/siteConfig'
import { safeFetch } from '../../../utils/safeUrl'

interface HealthItem { url: string; status: number; finalUrl: string | null }

function hashUrl(url: string): string {
  return createHash('sha1').update(url).digest('hex')
}

function uniqueHttpUrls(input: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const u = String(raw || '').trim()
    if (!/^https?:\/\//i.test(u)) continue
    if (seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

async function probe(url: string): Promise<HealthItem> {
  let hit = await safeFetch(url, {
    method: 'HEAD',
    timeout: 6000,
    headers: { Accept: '*/*' }
  })
  if (!hit || hit.res.status >= 400) {
    hit = await safeFetch(url, {
      method: 'GET',
      timeout: 6000,
      headers: { Accept: 'text/html,*/*;q=0.5', Range: 'bytes=0-0' }
    })
  }
  if (!hit) return { url, status: 0, finalUrl: null }
  try { await hit.res.body?.cancel() } catch {}
  return { url, status: hit.res.status, finalUrl: hit.finalUrl }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  let urls: string[] = []

  if (Array.isArray(body?.urls) && body.urls.length) {
    urls = uniqueHttpUrls(body.urls.map((x: any) => String(x || ''))).slice(0, 50)
  } else {
    const cfg = await getSiteConfig()
    const fromConfig: string[] = []
    for (const g of cfg.groups || []) for (const l of g.links || []) fromConfig.push(l.url)
    for (const l of cfg.recommended || []) fromConfig.push(l.url)
    const db = useDb()
    const [rows]: any = await db.query(
      "SELECT url FROM user_links WHERE is_public = 1 ORDER BY id DESC LIMIT 300"
    )
    urls = uniqueHttpUrls([...fromConfig, ...rows.map((r: any) => r.url)]).slice(0, 50)
  }

  if (!urls.length) return { items: [], checked: 0 }

  const items = await mapLimit(urls, 6, probe)
  const db = useDb()
  for (const it of items) {
    await db.execute(
      `INSERT INTO link_health (url_hash, url, status, final_url, checked_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), final_url = VALUES(final_url), checked_at = NOW()`,
      [hashUrl(it.url), it.url, it.status, it.finalUrl]
    )
  }

  return { items, checked: items.length }
})
