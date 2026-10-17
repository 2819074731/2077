import { fetchSiteMeta, normalizeSiteUrl } from '../utils/site'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const url = String(body?.url || '').trim()
  if (!url) throw createError({ statusCode: 400, statusMessage: '请输入网址' })
  normalizeSiteUrl(url)
  const meta = await fetchSiteMeta(url)
  if (!meta.title && !meta.description && !meta.icon) {
    throw createError({ statusCode: 502, statusMessage: '无法抓取该站点信息，请手动填写' })
  }
  return { meta }
})
