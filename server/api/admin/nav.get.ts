import { getSiteGroups } from '../../utils/siteGroups'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const groups = await getSiteGroups()
  return { groups }
})
