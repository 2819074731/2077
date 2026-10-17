import { normalizeSiteUrl } from './site'

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
  detail_enabled?: number
}

export function parseDirectoryId(input: unknown): number {
  const n = Number(String(input ?? '').replace(/\.html?$/i, ''))
  return Number.isInteger(n) && n > 0 ? n : 0
}

export function iconForUrl(url: string): string {
  try {
    return `/api/icon?url=${encodeURIComponent(new URL(url).hostname)}`
  } catch {
    return ''
  }
}

export function sanitizeDirectoryEntry(input: any): DirectoryEntry {
  const name = String(input?.name || '').trim().slice(0, 80)
  if (!name) throw createError({ statusCode: 400, statusMessage: '请填写站点名称' })
  const u = normalizeSiteUrl(String(input?.url || ''))
  const icon = String(input?.icon || '').trim().slice(0, 500) || iconForUrl(u.toString())
  const status = String(input?.status || 'published') === 'hidden' ? 'hidden' : 'published'
  return {
    name,
    url: u.toString().slice(0, 500),
    icon,
    category: String(input?.category || '其他').trim().slice(0, 60) || '其他',
    title: String(input?.title || '').trim().slice(0, 200),
    description: String(input?.description || '').trim().slice(0, 500),
    keywords: String(input?.keywords || '').trim().slice(0, 300),
    content: String(input?.content || '').trim().slice(0, 20000),
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
