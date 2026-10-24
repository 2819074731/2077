export const SEARCH_PAGE_SIZE = 20
export const SEARCH_MAX_PAGE_SIZE = 40

export const SEARCH_SORT_OPTIONS = [
  { value: 'relevance', label: '相关度' },
  { value: 'latest', label: '最新收录' },
  { value: 'name', label: '名称排序' }
] as const

export const SEARCH_TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'directory', label: '目录站点' },
  { value: 'link', label: '公开收藏' }
] as const

export type SearchSort = typeof SEARCH_SORT_OPTIONS[number]['value']
export type SearchType = typeof SEARCH_TYPE_OPTIONS[number]['value']

export interface SearchSortOption {
  value: string
  label: string
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch] || ch)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeQuery(input: unknown, max = 80): string {
  return String(input ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function splitTokens(input: unknown, max = 6): string[] {
  const text = normalizeQuery(input, 120)
  if (!text) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(' ')) {
    const token = raw.trim()
    if (!token || token.length > 40) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(token)
    if (out.length >= max) break
  }
  return out
}

export function isValidSearchSort(value: unknown): value is SearchSort {
  return SEARCH_SORT_OPTIONS.some(option => option.value === value)
}

export function isValidSearchType(value: unknown): value is SearchType {
  return SEARCH_TYPE_OPTIONS.some(option => option.value === value)
}

/**
 * 先转义 HTML，再高亮关键词，避免把用户输入直接塞进 v-html。
 */
export function highlightHtml(text: unknown, query: unknown): string {
  const raw = String(text ?? '')
  const tokens = splitTokens(query)
    .filter(token => token.length > 0)
    .sort((a, b) => b.length - a.length)
  if (!raw || !tokens.length) return escapeHtml(raw)
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi')
  return raw
    .split(pattern)
    .map((part, index) => (index % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join('')
}
