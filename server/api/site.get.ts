import { getSiteConfig } from '../utils/siteConfig'

export default defineEventHandler(async (event) => {
  const config = await getSiteConfig()
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return config
})
