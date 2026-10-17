import { normalizeSiteUrl } from '../../utils/site'
import { rateLimit } from '../../utils/rateLimit'
import { urlKey } from '#shared/nav'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'submit-check', 30, 60 * 1000)

  const body = await readBody(event)
  const u = normalizeSiteUrl(String(body?.url || ''))
  const key = urlKey(u.toString()).toLowerCase()
  const db = useDb()

  const [submissions]: any = await db.query(
    'SELECT id, user_id, status, access_token FROM submissions WHERE url_key = ? LIMIT 1',
    [key]
  )
  const [entries]: any = await db.query(
    'SELECT id FROM directory_entries WHERE url_key = ? LIMIT 1',
    [key]
  )

  const submission = submissions[0]
  const user = await getSessionUser(event)
  const token = submission?.access_token && user && Number(submission.user_id) === Number(user.id)
    ? String(submission.access_token)
    : null

  return {
    exists: !!submission,
    inDirectory: entries.length > 0,
    status: submission ? String(submission.status) : null,
    token
  }
})
