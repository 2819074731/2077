import { getFriendLinks, setFriendLinks } from '../../utils/friendLinks'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const links = await setFriendLinks(body?.links)
  return { ok: true, links }
})
