export type SubmitTarget = 'nav' | 'directory'
export type GithubSort = 'best' | 'stars' | 'forks' | 'updated'

export const DEFAULT_GITHUB_SEARCH_RELAYS = [
  'https://gh-proxy.com',
  'https://gh-proxy.org',
  'https://gh.llkk.cc',
  'https://ghproxy.icu'
]

export interface GithubSettings {
  enabled: boolean
  defaultSort: GithubSort
  pageSize: number
  maxPages: number
  showReadme: boolean
  readmeMaxKB: number
  filePreviewMaxKB: number
  showIssues: boolean
  showPulls: boolean
  showReleases: boolean
  showCommits: boolean
  showContributors: boolean
  showRefs: boolean
  enableZip: boolean
  enableReleaseDownload: boolean
  maxZipMB: number
  maxAssetMB: number
  rawMaxMB: number
  antiHotlink: boolean
  allowEmptyReferer: boolean
  refererWhitelist: string
  assetTtlSec: number
  imageMaxMB: number
  imageRatePerMin: number
  searchCacheSec: number
  searchFallback: boolean
  searchRelays: string[]
  repoCacheSec: number
  readmeCacheSec: number
}

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
  github: GithubSettings
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
  contactEmail: '',
  github: {
    enabled: true,
    defaultSort: 'best',
    pageSize: 20,
    maxPages: 20,
    showReadme: true,
    readmeMaxKB: 256,
    filePreviewMaxKB: 512,
    showIssues: true,
    showPulls: true,
    showReleases: true,
    showCommits: true,
    showContributors: true,
    showRefs: true,
    enableZip: true,
    enableReleaseDownload: true,
    maxZipMB: 512,
    maxAssetMB: 512,
    rawMaxMB: 20,
    antiHotlink: true,
    allowEmptyReferer: false,
    refererWhitelist: '',
    assetTtlSec: 600,
    imageMaxMB: 10,
    imageRatePerMin: 120,
    searchCacheSec: 300,
    searchFallback: true,
    searchRelays: [...DEFAULT_GITHUB_SEARCH_RELAYS],
    repoCacheSec: 300,
    readmeCacheSec: 600
  }
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

function relayList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const raw = item.trim()
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) continue
      const normalized = url.href.replace(/\/$/, '')
      if (!result.includes(normalized)) result.push(normalized)
    } catch {}
    if (result.length >= 6) break
  }
  return result
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

  const ghSrc = src.github && typeof src.github === 'object' ? src.github : {}
  const ghSort: GithubSort = ['best', 'stars', 'forks', 'updated'].includes(ghSrc.defaultSort)
    ? ghSrc.defaultSort
    : DEFAULT_SITE_SETTINGS.github.defaultSort

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
    contactEmail: text(src.contactEmail, DEFAULT_SITE_SETTINGS.contactEmail, 120),
    github: {
      enabled: bool(ghSrc.enabled, DEFAULT_SITE_SETTINGS.github.enabled),
      defaultSort: ghSort,
      pageSize: integer(ghSrc.pageSize, DEFAULT_SITE_SETTINGS.github.pageSize, 10, 30),
      maxPages: integer(ghSrc.maxPages, DEFAULT_SITE_SETTINGS.github.maxPages, 1, 20),
      showReadme: bool(ghSrc.showReadme, DEFAULT_SITE_SETTINGS.github.showReadme),
      readmeMaxKB: integer(ghSrc.readmeMaxKB, DEFAULT_SITE_SETTINGS.github.readmeMaxKB, 32, 512),
      filePreviewMaxKB: integer(ghSrc.filePreviewMaxKB, DEFAULT_SITE_SETTINGS.github.filePreviewMaxKB, 64, 2048),
      showIssues: bool(ghSrc.showIssues, DEFAULT_SITE_SETTINGS.github.showIssues),
      showPulls: bool(ghSrc.showPulls, DEFAULT_SITE_SETTINGS.github.showPulls),
      showReleases: bool(ghSrc.showReleases, DEFAULT_SITE_SETTINGS.github.showReleases),
      showCommits: bool(ghSrc.showCommits, DEFAULT_SITE_SETTINGS.github.showCommits),
      showContributors: bool(ghSrc.showContributors, DEFAULT_SITE_SETTINGS.github.showContributors),
      showRefs: bool(ghSrc.showRefs, DEFAULT_SITE_SETTINGS.github.showRefs),
      enableZip: bool(ghSrc.enableZip, DEFAULT_SITE_SETTINGS.github.enableZip),
      enableReleaseDownload: bool(ghSrc.enableReleaseDownload, DEFAULT_SITE_SETTINGS.github.enableReleaseDownload),
      maxZipMB: integer(ghSrc.maxZipMB, DEFAULT_SITE_SETTINGS.github.maxZipMB, 10, 1024),
      maxAssetMB: integer(ghSrc.maxAssetMB, DEFAULT_SITE_SETTINGS.github.maxAssetMB, 10, 2048),
      rawMaxMB: integer(ghSrc.rawMaxMB, DEFAULT_SITE_SETTINGS.github.rawMaxMB, 1, 100),
      antiHotlink: bool(ghSrc.antiHotlink, DEFAULT_SITE_SETTINGS.github.antiHotlink),
      allowEmptyReferer: bool(ghSrc.allowEmptyReferer, DEFAULT_SITE_SETTINGS.github.allowEmptyReferer),
      refererWhitelist: text(ghSrc.refererWhitelist, DEFAULT_SITE_SETTINGS.github.refererWhitelist, 500),
      assetTtlSec: integer(ghSrc.assetTtlSec, DEFAULT_SITE_SETTINGS.github.assetTtlSec, 60, 3600),
      imageMaxMB: integer(ghSrc.imageMaxMB, DEFAULT_SITE_SETTINGS.github.imageMaxMB, 1, 50),
      imageRatePerMin: integer(ghSrc.imageRatePerMin, DEFAULT_SITE_SETTINGS.github.imageRatePerMin, 10, 300),
      searchCacheSec: integer(ghSrc.searchCacheSec, DEFAULT_SITE_SETTINGS.github.searchCacheSec, 60, 3600),
      searchFallback: bool(ghSrc.searchFallback, DEFAULT_SITE_SETTINGS.github.searchFallback),
      searchRelays: relayList(ghSrc.searchRelays, DEFAULT_GITHUB_SEARCH_RELAYS),
      repoCacheSec: integer(ghSrc.repoCacheSec, DEFAULT_SITE_SETTINGS.github.repoCacheSec, 60, 3600),
      readmeCacheSec: integer(ghSrc.readmeCacheSec, DEFAULT_SITE_SETTINGS.github.readmeCacheSec, 60, 3600)
    }
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
