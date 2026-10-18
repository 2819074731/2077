import { Readable, Transform } from 'node:stream'
import { openGithubDownload } from '../../utils/github'
import { rateLimit } from '../../utils/rateLimit'

const MAX_BYTES = 512 * 1024 * 1024

function attachment(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'github-download', 15, 60_000)

  const q = getQuery(event)
  const repo = String(q.repo || '').trim()
  const kind = String(q.kind || 'zip') === 'asset' ? 'asset' : 'zip'
  const assetId = String(q.id || '')
  const requestedName = String(q.name || '')

  const file = await openGithubDownload(repo, kind, assetId, requestedName)
  const stream = Readable.fromWeb(file.response.body as any)
  let total = 0
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length
      if (total > MAX_BYTES) {
        callback(new Error('download-too-large'))
        return
      }
      callback(null, chunk)
    }
  })
  stream.on('error', (error) => limiter.destroy(error))
  stream.pipe(limiter)

  setHeader(event, 'Content-Type', file.contentType)
  setHeader(event, 'Content-Disposition', attachment(file.filename))
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Accel-Buffering', 'no')
  if (file.contentLength) setHeader(event, 'Content-Length', String(file.contentLength))

  return sendStream(event, limiter)
})
