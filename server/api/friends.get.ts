import { getFriendLinks } from '../utils/friendLinks'

export default defineEventHandler(async () => {
  return { links: await getFriendLinks() }
})
