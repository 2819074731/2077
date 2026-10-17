export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT url, status, final_url, checked_at FROM link_health ORDER BY checked_at DESC LIMIT 1000'
  )
  const items = rows.map((r: any) => ({
    url: r.url,
    status: Number(r.status || 0),
    finalUrl: r.final_url || null,
    checkedAt: r.checked_at
  }))
  return { items }
})
