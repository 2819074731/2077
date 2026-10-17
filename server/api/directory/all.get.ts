export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, name, url, category, detail_enabled, updated_at
     FROM directory_entries WHERE status = 'published'
     ORDER BY category ASC, featured DESC, sort ASC, id DESC LIMIT 5000`
  )
  const [categories]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries WHERE status = 'published'
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return { items: rows, categories }
})
