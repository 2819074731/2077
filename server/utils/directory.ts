import { normalizeSiteUrl } from './site'
import { cleanText, safeIcon } from './sanitize'

export interface DirectoryEntry {
  id?: number
  name: string
  url: string
  icon: string
  category: string
  title: string
  description: string
  keywords: string
  content: string
  featured: number
  sort: number
  status: string
  detail_enabled: number
}

export function parseDirectoryId(input: unknown): number {
  const n = Number(String(input ?? '').replace(/\.html?$/i, ''))
  return Number.isInteger(n) && n > 0 ? n : 0
}

export function canonicalKey(input: string): string {
  try {
    const u = new URL(String(input || ''))
    return (u.hostname.toLowerCase().replace(/^www\./, '') + u.pathname.replace(/\/+$/, '') + u.search).toLowerCase()
  } catch {
    return String(input || '').trim().toLowerCase()
  }
}

export function iconForUrl(url: string): string {
  try {
    return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}`
  } catch {
    return ''
  }
}

export function sanitizeDirectoryEntry(input: any): DirectoryEntry {
  const name = cleanText(input?.name, 80)
  if (!name) throw createError({ statusCode: 400, statusMessage: '请填写站点名称' })
  const u = normalizeSiteUrl(String(input?.url || ''))
  const icon = safeIcon(input?.icon) || iconForUrl(u.toString())
  const status = String(input?.status || 'published') === 'hidden' ? 'hidden' : 'published'
  return {
    name,
    url: u.toString().slice(0, 500),
    icon,
    category: cleanText(input?.category, 60) || '其他',
    title: cleanText(input?.title, 200),
    description: cleanText(input?.description, 500),
    keywords: cleanText(input?.keywords, 300),
    content: cleanText(input?.content, 20000, true),
    featured: input?.featured ? 1 : 0,
    sort: Math.max(0, Math.min(9999, Number(input?.sort) || 0)),
    status,
    detail_enabled: input?.detail_enabled === 0 || input?.detail_enabled === false ? 0 : 1
  }
}

export function autoDescription(entry: Pick<DirectoryEntry, 'name' | 'category' | 'url'>): string {
  let host = ''
  try { host = new URL(entry.url).hostname } catch {}
  return `${entry.name}（${host}）收录在 2077 导航「${entry.category || '其他'}」分类，提供官网入口、站点简介与同类站点推荐。`
}
