import { touchDirectoryCache } from '../../../utils/directoryCache'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0))].slice(0, 500)
    : []
  if (!ids.length) throw createError({ statusCode: 400, statusMessage: '请选择站点' })
  const hidden = body?.hidden !== false
  const db = useDb()
  const [result]: any = await db.execute(
    `UPDATE directory_entries
     SET health_hidden = ?, health_fail_count = ${hidden ? 'GREATEST(health_fail_count, 2)' : '0'}
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    [hidden ? 1 : 0, ...ids]
  )
  await touchDirectoryCache()
  return { ok: true, affected: Number(result?.affectedRows || 0), hidden }
})
