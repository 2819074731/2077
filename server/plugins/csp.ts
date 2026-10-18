import { createHash } from 'node:crypto'
import { useServerHooks } from 'nuxt/server'

const CHUNKS = ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const

function scriptHashes(parts: string[]): string[] {
  const hashes = new Set<string>()
  const svg = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  for (const part of parts) {
    for (const match of part.matchAll(svg)) {
      const attrs = match[1] || ''
      if (/\bsrc\s*=/i.test(attrs)) continue
      const content = match[2] || ''
      if (!content) continue
      hashes.add(createHash('sha256').update(content).digest('base64'))
    }
  }
  return [...hashes]
}

export default defineNitroPlugin(() => {
  if (import.meta.dev) return
  useServerHooks().hook('render:html', (html, { event }) => {
    const parts = CHUNKS.flatMap(key => html[key])
    const hashes = scriptHashes(parts)
    const script = ["'self'", ...hashes.map(h => `'sha256-${h}'`)].join(' ')
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src ${script}`,
      "connect-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      'report-to csp'
    ].join('; ')
    setHeader(event, 'Content-Security-Policy', csp)
  })
})
