import { getNetEaseComment } from '../../utils/neteaseComments'

export default defineEventHandler(async (event) => {
  // 返回随机一条，禁用 CDN 缓存，否则「换一句」始终命中同一条。
  setHeader(event, 'Cache-Control', 'no-store')
  const exclude = String(getQuery(event).exclude || '').slice(0, 120)
  const item = await getNetEaseComment(exclude)
  if (!item) return { text: '', source: 'fallback' as const, song: '' }
  return { text: item.text, source: item.source, song: item.song }
})
