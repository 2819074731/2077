import { getNetEaseComment } from '../../utils/neteaseComments'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  const item = await getNetEaseComment()
  if (!item) return { text: '', source: 'fallback' as const }
  return { text: item.text, source: 'netease' as const }
})
