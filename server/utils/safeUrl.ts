import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { Readable } from 'node:stream'

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
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  return isIP(h) ? isPrivateIp(h) : false
}

/** 解析并校验公网地址；返回已校验的地址列表，供连接时钉扎，避免 DNS rebinding。 */
export async function resolvePublicAddresses(u: URL): Promise<Array<{ address: string; family: number }>> {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('port')
  if (isPrivateHost(u.hostname)) throw new Error('private-host')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  const literal = isIP(host)
  const addrs = literal
    ? [{ address: host, family: literal }]
    : await lookup(host, { all: true, verbatim: true })
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('private-ip')
  return addrs.map(a => ({ address: a.address, family: a.family }))
}

/** 校验 URL 为公网 http(s) 地址，域名解析结果命中内网时拒绝。 */
export async function assertPublicHttpUrl(u: URL): Promise<void> {
  await resolvePublicAddresses(u)
}

async function pinnedFetch(
  u: URL,
  addrs: Array<{ address: string; family: number }>,
  opts: SafeFetchOptions,
  timeout: number
): Promise<Response> {
  const target = addrs[0]
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; 2077Bot/1.0; +https://my2077.com)',
    ...opts.headers
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    return await new Promise<Response>((resolve, reject) => {
      const request = u.protocol === 'https:' ? httpsRequest : httpRequest
      const req = request(u, {
        method: opts.method || 'GET',
        headers,
        signal: ctrl.signal,
        // 钉扎到已校验的 IP，TLS 仍使用原域名做 SNI/Host 校验。
        lookup: (_hostname: string, options: any, cb: any) => {
          if (options?.all) cb(null, addrs.map(a => ({ address: a.address, family: a.family })))
          else cb(null, target.address, target.family)
        },
        ...(u.protocol === 'https:' ? { servername: u.hostname.replace(/^\[|\]$/g, '') } : {})
      }, (res) => {
        const responseHeaders = new Headers()
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) value.forEach(v => responseHeaders.append(key, v))
          else if (value != null) responseHeaders.set(key, value)
        }
        resolve(new Response(Readable.toWeb(res) as ReadableStream, {
          status: res.statusCode || 502,
          statusText: res.statusMessage || '',
          headers: responseHeaders
        }))
      })
      req.on('error', reject)
      req.end()
    })
  } finally {
    clearTimeout(timer)
  }
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
    let addrs: Array<{ address: string; family: number }>
    try {
      u = new URL(current)
      addrs = await resolvePublicAddresses(u)
    } catch {
      return null
    }

    const remain = deadline - Date.now()
    if (remain <= 0) return null
    let res: Response
    try {
      res = await pinnedFetch(u, addrs, opts, remain)
    } catch {
      return null
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

/** 限制响应体大小与读取时长的读取；超限抛错。 */
export async function readBodyCapped(res: Response, maxBytes: number, timeoutMs = 8000, allowTruncate = false): Promise<Buffer> {
  const reader = res.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []
  let total = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reader.cancel().catch(() => {})
      reject(new Error('body-timeout'))
    }, timeoutMs)
  })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout])
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        if (allowTruncate) break
        throw new Error('body-too-large')
      }
      chunks.push(value)
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c)))
}
