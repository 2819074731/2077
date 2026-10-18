import { Readable, Transform } from 'node:stream'
import { openGithubRaw } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'

const MAX_BYTES = 20 * 1024 * 1024

function attachment(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-raw', 30, 60_000)

  const q = getQuery(event)
  const repo = String(q.repo || '').trim()
  const path = String(q.path || '')
  const download = String(q.download || '') === '1'

  const file = await openGithubRaw(repo, path)
  const stream = Readable.fromWeb(file.response.body as any)
  let total = 0
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length
      if (total > MAX_BYTES) {
        callback(new Error('file-too-large'))
        return
      }
      callback(null, chunk)
    }
  })
  stream.on('error', (error) => limiter.destroy(error))
  stream.pipe(limiter)

  const isImage = /^image\//i.test(file.contentType)
  setHeader(event, 'Content-Type', download ? 'application/octet-stream' : (isImage ? file.contentType : 'text/plain; charset=utf-8'))
  setHeader(event, 'Content-Disposition', download ? attachment(file.filename) : 'inline')
  setHeader(event, 'Cache-Control', 'public, max-age=120, stale-while-revalidate=300')
  setHeader(event, 'X-Accel-Buffering', 'no')
  setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'")
  if (file.contentLength) setHeader(event, 'Content-Length', String(file.contentLength))

  return sendStream(event, limiter)
})
