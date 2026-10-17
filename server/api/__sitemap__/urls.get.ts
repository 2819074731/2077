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
  const [provinces]: any = await db.query(
    `SELECT province, COUNT(*) AS n, MAX(updated_at) AS updated_at
     FROM directory_entries WHERE status = 'published' AND category = '高校' AND province <> ''
     GROUP BY province ORDER BY n DESC, province ASC`
  )
  const [users]: any = await db.query(
    `SELECT u.id, u.created_at, COUNT(ul.id) AS public_links
     FROM users u
     JOIN user_links ul ON ul.user_id = u.id AND ul.is_public = 1
     WHERE u.is_admin = 0
     GROUP BY u.id, u.created_at
     ORDER BY u.id ASC`
  )
  const urls: any[] = [
    { loc: '/', changefreq: 'daily', priority: 1 },
    { loc: '/site', changefreq: 'daily', priority: 0.9 },
    { loc: '/submit', changefreq: 'monthly', priority: 0.6 },
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
  for (const p of provinces) {
    urls.push({
      loc: `/site?category=${encodeURIComponent('高校')}&province=${encodeURIComponent(p.province)}`,
      lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
      changefreq: 'weekly',
      priority: 0.75
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
  for (const u of users) {
    if (Number(u.public_links || 0) <= 0) continue
    urls.push({
      loc: `/u/${u.id}`,
      lastmod: u.created_at ? new Date(u.created_at).toISOString() : undefined,
      changefreq: 'weekly',
      priority: 0.4
    })
  }
  return urls
})
