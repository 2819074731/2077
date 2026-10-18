import { normalizeSiteSettings } from '#shared/siteSettings'
import { requireAdmin } from '../../../utils/auth'
import { readStoredSiteSettings, saveSiteSettings } from '../../../utils/siteSettings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const raw = body && typeof body === 'object' ? body : {}
  const githubInput = raw.github && typeof raw.github === 'object' ? raw.github : {}
  const current = await readStoredSiteSettings()
  const next = normalizeSiteSettings({ ...current, github: githubInput })
  const saved = await saveSiteSettings(next)
  return { ok: true, github: saved.github }
})
