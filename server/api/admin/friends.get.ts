import { getFriendLinks } from '../../utils/friendLinks'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { links: await getFriendLinks() }
})
