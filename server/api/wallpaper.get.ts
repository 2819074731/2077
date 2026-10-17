import { getWallpapers } from '../utils/wallpaper'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const n = Math.min(16, Math.max(1, Number(q.n) || 8))
  const items = await getWallpapers(n)
  setHeader(event, 'Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600')
  return { items }
})
