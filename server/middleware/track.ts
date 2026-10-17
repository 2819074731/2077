import { clientIpFrom, recordTraffic, shouldTrack } from '../utils/traffic'

export default defineEventHandler((event) => {
  if (event.node.req.method !== 'GET') return
  const path = String(event.path || '').split('?')[0]
  if (!shouldTrack(path)) return

  const headers = event.node.req.headers as Record<string, any>
  const ip = clientIpFrom(headers, event.node.req.socket?.remoteAddress)
  const ua = String(headers['user-agent'] || '')
  const referer = String(headers.referer || '')

  event.node.res.once('finish', () => {
    const status = event.node.res.statusCode
    if (status < 200 || status >= 400) return
    void recordTraffic({ path, ip, ua, referer, status }).catch(() => {})
  })
})
