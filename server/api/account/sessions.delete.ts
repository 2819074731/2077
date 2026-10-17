export default defineEventHandler(async (event) => {
  const me = await getSessionUser(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: '未登录' })
  const removed = await revokeOtherSessions(event, me.id)
  return { ok: true, removed }
})
