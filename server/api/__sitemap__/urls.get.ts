export default defineEventHandler(async () => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, updated_at FROM directory_entries WHERE status = 'published' AND detail_enabled = 1 ORDER BY id ASC`
  )
  const [cats]: any = await db.query(
    `SELECT category, COUNT(*) AS n, MAX(updated_at) AS updated_at
     FROM directory_entries WHERE status = 'published'
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  const urls: any[] = [
    { loc: '/', changefreq: 'daily', priority: 1 },
    { loc: '/site', changefreq: 'daily', priority: 0.9 },
    { loc: '/sitemap', changefreq: 'weekly', priority: 0.5 }
  ]
  for (const c of cats) {
    if (!c.category) continue
    urls.push({
      loc: `/site?category=${encodeURIComponent(c.category)}`,
      lastmod: c.updated_at ? new Date(c.updated_at).toISOString() : undefined,
      changefreq: 'weekly',
      priority: 0.8
    })
  }
  for (const r of rows) {
    urls.push({
      loc: `/site/${r.id}.html`,
      lastmod: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      changefreq: 'weekly',
      priority: 0.7
    })
  }
  return urls
})
