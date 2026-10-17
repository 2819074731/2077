import { getSiteConfig } from '../../../utils/siteConfig'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = await getSiteConfig()
  const payload = {
    type: 'my2077-nav',
    version: 1,
    exportedAt: new Date().toISOString(),
    groups: cfg.groups,
    recommended: cfg.recommended || []
  }
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="my2077-nav-${Date.now()}.json"`)
  return payload
})
