import { getSiteSearchIndexStatus } from '../../utils/siteSearch'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const status = await getSiteSearchIndexStatus(useDb())
  return { status }
})
