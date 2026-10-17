import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./
]

export function isPrivateIp(ip: string): boolean {
  const v = String(ip || '').toLowerCase()
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  if (isIP(v) === 4) return PRIVATE_V4.some(r => r.test(v))
  if (isIP(v) === 6) {
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
  }
  return true
}

export function isPrivateHost(host: string): boolean {
  const h = String(host || '').toLowerCase()
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  return isIP(h) ? isPrivateIp(h) : false
}

/** 校验 URL 为公网 http(s) 地址，域名解析结果命中内网时拒绝。 */
export async function assertPublicHttpUrl(u: URL): Promise<void> {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('port')
  if (isPrivateHost(u.hostname)) throw new Error('private-host')
  const addrs = await lookup(u.hostname, { all: true, verbatim: true })
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('private-ip')
}

export interface SafeFetchOptions {
  method?: string
  timeout?: number
  headers?: Record<string, string>
  maxRedirects?: number
}

/**
 * 带 SSRF 防护的 fetch：逐跳校验协议、端口、DNS 解析结果，手动跟随重定向。
 * 返回 null 表示地址不合法或请求失败。
 */
export async function safeFetch(input: string, opts: SafeFetchOptions = {}): Promise<{ res: Response; finalUrl: string } | null> {
  const maxRedirects = opts.maxRedirects ?? 3
  const deadline = Date.now() + (opts.timeout ?? 8000)
  let current = input

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let u: URL
    try {
      u = new URL(current)
      await assertPublicHttpUrl(u)
    } catch {
      return null
    }

    const remain = deadline - Date.now()
    if (remain <= 0) return null
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), remain)
    let res: Response
    try {
      res = await fetch(u, {
        method: opts.method || 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; 2077Bot/1.0; +https://my2077.com)',
          ...opts.headers
        }
      })
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) return { res, finalUrl: u.toString() }
      try {
        current = new URL(loc, u).toString()
      } catch {
        return null
      }
      continue
    }

    return { res, finalUrl: u.toString() }
  }

  return null
}

/** 限制响应体大小的读取；超限抛错。 */
export async function readBodyCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new Error('body-too-large')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c)))
}
