export type SubmitTarget = 'nav' | 'directory'

export interface SiteSettings {
  siteName: string
  siteShortName: string
  siteTagline: string
  siteDescription: string
  siteKeywords: string
  submitDefaultTarget: SubmitTarget
  submitAllowNav: boolean
  submitAllowDirectory: boolean
  submitReviewDays: string
  submitNotice: string
  directoryPageSize: number
  maintenanceSchedule: string
  linkTtlDays: number
  tdkTtlDays: number
  icpNumber: string
  contactEmail: string
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: '2077 导航',
  siteShortName: '2077',
  siteTagline: '可自定义的浏览器起始页',
  siteDescription: '2077 导航：可自定义的浏览器起始页，聚合常用站点，支持离线使用与云端同步。',
  siteKeywords: '网址导航,网站目录,浏览器起始页,2077导航',
  submitDefaultTarget: 'directory',
  submitAllowNav: true,
  submitAllowDirectory: true,
  submitReviewDays: '1-3',
  submitNotice: '提交内容会经过格式过滤与人工审核。请勿提交恶意跳转、弹窗广告、侵权或违法违规内容，否则将被拒绝收录。',
  directoryPageSize: 20,
  maintenanceSchedule: '04:10',
  linkTtlDays: 7,
  tdkTtlDays: 7,
  icpNumber: '',
  contactEmail: ''
}

function text(value: unknown, fallback: string, max: number): string {
  if (typeof value !== 'string') return fallback
  return value.trim().slice(0, max)
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** 统一清洗配置，服务端保存与公开读取共用，避免历史脏数据进入页面。 */
export function normalizeSiteSettings(raw: any): SiteSettings {
  const src = raw && typeof raw === 'object' ? raw : {}
  let allowNav = bool(src.submitAllowNav, DEFAULT_SITE_SETTINGS.submitAllowNav)
  let allowDirectory = bool(src.submitAllowDirectory, DEFAULT_SITE_SETTINGS.submitAllowDirectory)
  if (!allowNav && !allowDirectory) {
    allowNav = true
    allowDirectory = true
  }

  let defaultTarget: SubmitTarget = src.submitDefaultTarget === 'nav' ? 'nav' : 'directory'
  if (defaultTarget === 'nav' && !allowNav && allowDirectory) defaultTarget = 'directory'
  if (defaultTarget === 'directory' && !allowDirectory && allowNav) defaultTarget = 'nav'

  let schedule = text(src.maintenanceSchedule, DEFAULT_SITE_SETTINGS.maintenanceSchedule, 5)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule)) schedule = DEFAULT_SITE_SETTINGS.maintenanceSchedule

  return {
    siteName: text(src.siteName, DEFAULT_SITE_SETTINGS.siteName, 40) || DEFAULT_SITE_SETTINGS.siteName,
    siteShortName: text(src.siteShortName, DEFAULT_SITE_SETTINGS.siteShortName, 12) || DEFAULT_SITE_SETTINGS.siteShortName,
    siteTagline: text(src.siteTagline, DEFAULT_SITE_SETTINGS.siteTagline, 80),
    siteDescription: text(src.siteDescription, DEFAULT_SITE_SETTINGS.siteDescription, 300),
    siteKeywords: text(src.siteKeywords, DEFAULT_SITE_SETTINGS.siteKeywords, 300),
    submitDefaultTarget: defaultTarget,
    submitAllowNav: allowNav,
    submitAllowDirectory: allowDirectory,
    submitReviewDays: text(src.submitReviewDays, DEFAULT_SITE_SETTINGS.submitReviewDays, 20) || DEFAULT_SITE_SETTINGS.submitReviewDays,
    submitNotice: text(src.submitNotice, DEFAULT_SITE_SETTINGS.submitNotice, 300),
    directoryPageSize: integer(src.directoryPageSize, DEFAULT_SITE_SETTINGS.directoryPageSize, 12, 48),
    maintenanceSchedule: schedule,
    linkTtlDays: integer(src.linkTtlDays, DEFAULT_SITE_SETTINGS.linkTtlDays, 1, 90),
    tdkTtlDays: integer(src.tdkTtlDays, DEFAULT_SITE_SETTINGS.tdkTtlDays, 1, 90),
    icpNumber: text(src.icpNumber, DEFAULT_SITE_SETTINGS.icpNumber, 60),
    contactEmail: text(src.contactEmail, DEFAULT_SITE_SETTINGS.contactEmail, 120)
  }
}

export function submitTargetEnabled(settings: SiteSettings, target: SubmitTarget): boolean {
  return target === 'nav' ? settings.submitAllowNav : settings.submitAllowDirectory
}

export function preferredSubmitTarget(settings: SiteSettings): SubmitTarget {
  const target = settings.submitDefaultTarget
  if (submitTargetEnabled(settings, target)) return target
  return settings.submitAllowNav ? 'nav' : 'directory'
}
