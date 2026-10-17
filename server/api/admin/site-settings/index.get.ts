import { getSiteSettings } from '../../../utils/siteSettings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await getSiteSettings()
})
