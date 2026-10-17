export default defineEventHandler(async () => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, updated_at FROM directory_entries WHERE status = 'published' AND detail_enabled = 1 ORDER BY id ASC`
  )
  const urls: any[] = [
    { loc: '/', changefreq: 'daily', priority: 1 },
    { loc: '/site', changefreq: 'daily', priority: 0.9 }
  ]
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
