import { getHotSearch } from '../utils/hotSearch'

export default defineEventHandler(async (event) => {
  const engine = String(getQuery(event).engine || 'bing').toLowerCase()
  const data = await getHotSearch(engine)
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return {
    engine,
    items: data.items,
    live: data.live,
    at: Date.now()
  }
})
