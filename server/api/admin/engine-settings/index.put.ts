import { normalizeSiteSettings } from '#shared/siteSettings'
import { requireAdmin } from '../../../utils/auth'
import { readStoredSiteSettings, saveSiteSettings } from '../../../utils/siteSettings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const raw = body && typeof body === 'object' ? body : {}
  const githubInput = raw.github && typeof raw.github === 'object' ? raw.github : null
  const googleInput = raw.google && typeof raw.google === 'object' ? raw.google : null
  if (!githubInput && !googleInput) {
    throw createError({ statusCode: 400, statusMessage: '没有需要保存的引擎配置' })
  }

  const current = await readStoredSiteSettings()
  const next = normalizeSiteSettings({
    ...current,
    ...(githubInput ? { github: githubInput } : {}),
    ...(googleInput ? { google: googleInput } : {})
  })
  const saved = await saveSiteSettings(next)
  return { ok: true, github: saved.github, google: saved.google }
})
