import { geocodeCity, getWeather } from '../../utils/weather'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const city = String(q.city || '').trim()
  if (!city) throw createError({ statusCode: 400, message: '请输入城市名称' })

  const geo = await geocodeCity(city)
  if (!geo) throw createError({ statusCode: 404, message: '未找到该城市' })

  const weather = await getWeather(geo.lat, geo.lon)
  if (!weather) throw createError({ statusCode: 502, message: '天气服务暂不可用' })

  setHeader(event, 'Cache-Control', 'public, max-age=1800')
  return { place: geo.name, located: false, geo, ...weather }
})
