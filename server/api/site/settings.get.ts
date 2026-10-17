import { getSiteSettings } from '../../utils/siteSettings'

export default defineEventHandler(async (event) => {
  const settings = await getSiteSettings()
  setHeader(event, 'Cache-Control', 'public, max-age=15, stale-while-revalidate=45')
  return settings
})
