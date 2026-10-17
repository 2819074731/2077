import { getSiteGroups } from '../utils/siteGroups'

export default defineEventHandler(async (event) => {
  const groups = await getSiteGroups()
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return { groups }
})
