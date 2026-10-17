import { clientIp, getWeather, locateByIp } from '../utils/weather'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  let lat = Number(q.lat)
  let lon = Number(q.lon)
  let place = String(q.city || '').trim()
  let located = false

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const ip = clientIp(event)
    const loc = await locateByIp(ip)
    if (!loc) throw createError({ statusCode: 502, message: '无法定位当前位置' })
    lat = loc.lat
    lon = loc.lon
    place = loc.city || loc.province || loc.country || '当前位置'
    located = true
  }

  const weather = await getWeather(lat, lon)
  if (!weather) throw createError({ statusCode: 502, message: '天气服务暂不可用' })

  setHeader(event, 'Cache-Control', 'public, max-age=600')
  return { place, located, ...weather }
})
