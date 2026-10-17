import { getSiteCategories } from '../utils/categories'

export default defineEventHandler(async (event) => {
  const categories = await getSiteCategories()
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return { categories }
})
