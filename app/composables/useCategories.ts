export function useCategories() {
  const categories = useState<string[]>('site-categories', () => [])
  const loaded = useState<boolean>('site-categories-loaded', () => false)
  const loading = useState<boolean>('site-categories-loading', () => false)

  async function loadCategories(force = false) {
    if (loaded.value && !force) return categories.value
    if (loading.value) return categories.value
    loading.value = true
    try {
      const d: any = await $fetch('/api/categories')
      if (Array.isArray(d?.categories)) categories.value = d.categories
      loaded.value = true
    } catch {}
    finally {
      loading.value = false
    }
    return categories.value
  }

  return { categories, loadCategories }
}
