import { getSiteConfig } from '../../../utils/siteConfig'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = await getSiteConfig()
  return { groups: cfg.groups, recommended: cfg.recommended || [] }
})
