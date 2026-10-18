import { getSiteCategories } from '../utils/categories'

export default defineEventHandler(async (event) => {
  const categories = await getSiteCategories()
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return { categories }
})
