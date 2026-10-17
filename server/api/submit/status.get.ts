interface SubmissionRow {
  id: number
  name: string
  url: string
  status: string
  target: string
  grp: string
  created_at: string | Date
  reviewed_at?: string | Date | null
  access_token?: string | null
}

function presentSubmission(row: SubmissionRow, includeToken = false) {
  const item: Record<string, unknown> = {
    id: Number(row.id),
    name: row.name,
    url: row.url,
    status: row.status,
    target: row.target,
    grp: row.grp,
    created_at: row.created_at
  }
  if (row.reviewed_at) item.reviewed_at = row.reviewed_at
  if (includeToken && row.access_token) item.token = row.access_token
  return item
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = String(query.token || '').trim().slice(0, 128)
  const db = useDb()

  if (token) {
    const [rows]: any = await db.query(
      'SELECT * FROM submissions WHERE access_token = ? LIMIT 1',
      [token]
    )
    const row = rows[0] as SubmissionRow | undefined
    if (!row) throw createError({ statusCode: 404, statusMessage: '未找到提交记录' })
    return { submission: presentSubmission(row) }
  }

  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 400, statusMessage: '缺少查询凭证' })

  const [rows]: any = await db.query(
    'SELECT * FROM submissions WHERE user_id = ? ORDER BY id DESC LIMIT 20',
    [user.id]
  )
  return {
    items: (rows as SubmissionRow[]).map((row) => presentSubmission(row, true))
  }
})
