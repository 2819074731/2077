import { Readable, Transform } from 'node:stream'
import { assertGithubAssetAccess, isGithubImageHost } from '../../utils/githubAsset'
import { requireGithubSettings } from '../../utils/githubSettings'
import { rateLimit } from '../../utils/rateLimit'
import { safeFetch } from '../../utils/safeUrl'

export default defineEventHandler(async (event) => {
  const settings = await requireGithubSettings()
  await rateLimit(event, 'github-image', Math.max(10, Number(settings.imageRatePerMin) || 120), 60_000)

  const q = getQuery(event)
  const url = String(q.url || '').trim()
  if (!url || url.length > 2000 || !isGithubImageHost(url)) {
    throw createError({ statusCode: 400, statusMessage: '图片地址不正确' })
  }
  assertGithubAssetAccess(event, 'image', url, settings)

  const hit = await safeFetch(url, {
    timeout: 15000,
    maxRedirects: 4,
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8',
      'User-Agent': '2077Bot/1.0 (+https://my2077.com)'
    }
  })
  if (!hit) throw createError({ statusCode: 502, statusMessage: '图片加载失败' })

  const { res } = hit
  if (!res.ok) {
    try { await res.body?.cancel() } catch {}
    throw createError({ statusCode: res.status === 404 ? 404 : 502, statusMessage: '图片加载失败' })
  }

  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!/^image\//.test(type)) {
    try { await res.body?.cancel() } catch {}
    throw createError({ statusCode: 415, statusMessage: '该地址不是图片' })
  }

  const maxBytes = Math.max(1, Number(settings.imageMaxMB) || 10) * 1024 * 1024
  const length = Number(res.headers.get('content-length') || 0)
  if (length > maxBytes) {
    try { await res.body?.cancel() } catch {}
    throw createError({ statusCode: 413, statusMessage: '图片过大' })
  }

  const stream = Readable.fromWeb(res.body as any)
  let total = 0
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length
      if (total > maxBytes) {
        callback(new Error('image-too-large'))
        return
      }
      callback(null, chunk)
    }
  })
  stream.on('error', (error) => limiter.destroy(error))
  stream.pipe(limiter)

  setHeader(event, 'Content-Type', type)
  setHeader(event, 'Content-Disposition', 'inline')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Accel-Buffering', 'no')
  setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'")
  if (Number.isFinite(length) && length > 0) setHeader(event, 'Content-Length', String(length))

  return sendStream(event, limiter)
})
