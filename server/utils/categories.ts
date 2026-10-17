import { DEFAULT_CATEGORY, SITE_CATEGORIES as BUILTIN_CATEGORIES } from '#shared/categories'
import { getSetting, setSetting } from './settings'

const SETTING_KEY = 'site_categories'

function cleanName(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)
}

export function normalizeCategoryList(input: unknown): string[] {
  const list: string[] = []
  const seen = new Set<string>()
  if (Array.isArray(input)) {
    for (const raw of input) {
      const name = cleanName(raw)
      if (!name || seen.has(name)) continue
      seen.add(name)
      list.push(name)
    }
  }
  if (!list.length) {
    return [...BUILTIN_CATEGORIES]
  }
  if (!seen.has(DEFAULT_CATEGORY)) list.push(DEFAULT_CATEGORY)
  return list
}

/** 读取全局网站分类；未配置时使用内置分类。 */
export async function getSiteCategories(): Promise<string[]> {
  const stored = await getSetting<unknown>(SETTING_KEY, null)
  return normalizeCategoryList(stored)
}

export async function saveSiteCategories(list: unknown): Promise<string[]> {
  const categories = normalizeCategoryList(list)
  await setSetting(SETTING_KEY, categories)
  return categories
}

/** 将任意分类名归一化到现有分类，不存在时回退到「其他」。 */
export async function resolveSiteCategory(value: unknown, fallback = DEFAULT_CATEGORY): Promise<string> {
  const name = cleanName(value)
  const categories = await getSiteCategories()
  if (categories.includes(name)) return name
  if (categories.includes(fallback)) return fallback
  return DEFAULT_CATEGORY
}

export function isProtectedCategory(name: string): boolean {
  return name === DEFAULT_CATEGORY
}
