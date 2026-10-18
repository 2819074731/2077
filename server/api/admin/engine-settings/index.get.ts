import { requireAdmin } from '../../../utils/auth'
import { readStoredSiteSettings } from '../../../utils/siteSettings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const settings = await readStoredSiteSettings()
  return { github: settings.github }
})
