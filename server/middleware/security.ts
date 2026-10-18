const BASE = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:"
]

const DEV_CSP = [
  ...BASE.slice(0, 8),
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  ...BASE.slice(8)
].join('; ')

export default defineEventHandler((event) => {
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  setHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')
  setHeader(event, 'Reporting-Endpoints', 'csp="/api/csp-report"')

  if (import.meta.dev) {
    setHeader(event, 'Content-Security-Policy-Report-Only', DEV_CSP)
  } else {
    // 生产环境的脚本 hash 由 render:html 钩子按实际 HTML 追加。
    setHeader(event, 'Content-Security-Policy', [...BASE, "script-src 'self'", 'report-to csp'].join('; '))
  }

  const accept = getRequestHeader(event, 'accept') || ''
  if (accept.includes('text/html') && !getResponseHeader(event, 'cache-control')) {
    setHeader(event, 'Cache-Control', 'no-cache, must-revalidate')
  }

  const forwarded = getRequestHeader(event, 'x-forwarded-proto') || ''
  if (forwarded.split(',')[0].trim() === 'https' || event.node.req.socket.encrypted) {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})
