import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from '#shared/siteSettings'
import { readStoredSiteSettings, saveSiteSettings } from '../../../utils/siteSettings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const raw = body && typeof body === 'object' ? body : {}
  const settings = normalizeSiteSettings(raw)

  if (!String(raw.siteName || '').trim()) {
    throw createError({ statusCode: 400, statusMessage: '请填写站点名称' })
  }
  if (!String(raw.siteShortName || '').trim()) {
    throw createError({ statusCode: 400, statusMessage: '请填写 LOGO 短名称' })
  }
  if (!raw.submitAllowNav && !raw.submitAllowDirectory) {
    throw createError({ statusCode: 400, statusMessage: '至少保留一种收录方式' })
  }
  const email = String(raw.contactEmail || '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: '联系邮箱格式不正确' })
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.maintenanceSchedule || ''))) {
    throw createError({ statusCode: 400, statusMessage: '巡检时间格式应为 HH:MM' })
  }
  const pageSize = Number(raw.directoryPageSize)
  if (!Number.isInteger(pageSize) || pageSize < 12 || pageSize > 48) {
    throw createError({ statusCode: 400, statusMessage: '目录每页数量需在 12-48 之间' })
  }
  for (const key of ['linkTtlDays', 'tdkTtlDays'] as const) {
    const value = Number(raw[key])
    if (!Number.isInteger(value) || value < 1 || value > 90) {
      throw createError({ statusCode: 400, statusMessage: '巡检周期需在 1-90 天之间' })
    }
  }

  const stored = await readStoredSiteSettings()
  const saved = await saveSiteSettings({
    ...DEFAULT_SITE_SETTINGS,
    ...settings,
    github: stored.github,
    siteName: String(raw.siteName).trim(),
    siteShortName: String(raw.siteShortName).trim(),
    contactEmail: email
  })
  return { ok: true, settings: saved }
})
