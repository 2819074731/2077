import { createHash } from 'node:crypto'

const BOTS: Array<[RegExp, string]> = [
  [/googlebot|google-inspectiontool/i, 'Googlebot'],
  [/bingbot|bingpreview/i, 'Bingbot'],
  [/baiduspider/i, 'Baiduspider'],
  [/yandex(bot)?/i, 'YandexBot'],
  [/sogou (web )?spider|sogou spider/i, 'Sogou'],
  [/360spider|haosouspider/i, '360Spider'],
  [/bytespider/i, 'Bytespider'],
  [/gptbot|chatgpt-user|oai-searchbot/i, 'GPTBot'],
  [/claudebot|claude-web/i, 'ClaudeBot'],
  [/perplexitybot/i, 'PerplexityBot'],
  [/ccbot/i, 'CCBot'],
  [/applebot/i, 'Applebot'],
  [/duckduckbot/i, 'DuckDuckBot'],
  [/facebookexternalhit/i, 'Facebook'],
  [/twitterbot/i, 'Twitterbot'],
  [/linkedinbot/i, 'LinkedIn'],
  [/telegrambot/i, 'Telegram'],
  [/semrushbot/i, 'SemrushBot'],
  [/ahrefsbot/i, 'AhrefsBot'],
  [/mj12bot/i, 'MJ12bot'],
  [/petalbot/i, 'PetalBot'],
  [/yisouspider/i, 'YisouSpider'],
  [/amazonbot/i, 'Amazonbot'],
  [/googleother/i, 'GoogleOther'],
  [/dataforseobot/i, 'DataForSeoBot'],
  [/serpstatbot/i, 'SerpstatBot'],
  [/blexbot/i, 'BLEXBot'],
  [/dotbot/i, 'DotBot'],
  [/seznambot/i, 'SeznamBot'],
  [/naver/i, 'NaverBot'],
  [/daumoa/i, 'Daum'],
  [/qwantify/i, 'Qwantify'],
  [/mojeekbot/i, 'MojeekBot'],
  [/slurp/i, 'Yahoo'],
  [/uptimerobot/i, 'UptimeRobot'],
  [/headlesschrome|phantomjs|selenium/i, 'Headless'],
  [/crawler|spider|bot\b/i, 'OtherBot']
]

export function classifyBot(ua: string): string {
  const s = String(ua || '')
  for (const [re, name] of BOTS) if (re.test(s)) return name
  return ''
}

export function isMobileUa(ua: string): boolean {
  return /mobile|android|iphone|ipad|ipod|harmonyos|phone|blackberry|opera mini/i.test(String(ua || ''))
}

export function clientIpFrom(headers: Record<string, any>, socketIp?: string): string {
  const xff = String(headers['x-forwarded-for'] || '')
  return (xff.split(',')[0] || '').trim() || String(headers['x-real-ip'] || '') || String(socketIp || '') || 'unknown'
}

export function hashValue(input: string): string {
  return createHash('sha1').update(input).digest('hex')
}

export function localDayKey(value: any = new Date()): string {
  if (typeof value === 'string') return value.slice(0, 10)
  const d = value instanceof Date ? value : new Date(value)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function shouldTrack(path: string): boolean {
  if (!path) return false
  if (path.startsWith('/api') || path.startsWith('/_nuxt') || path.startsWith('/admin')) return false
  if (path.startsWith('/settings') || path.startsWith('/login') || path.startsWith('/register')) return false
  if (path.startsWith('/share') || path.startsWith('/auth')) return false
  if (path === '/robots.txt' || path === '/sitemap.xml' || path === '/sitemap_index.xml') return true
  if (path === '/' || path === '/submit' || path === '/search' || path === '/github' || path === '/google') return true
  if (path === '/site' || path.startsWith('/site/')) return true
  if (path.startsWith('/u/')) return true
  return false
}

export interface TrafficHit {
  path: string
  ip: string
  ua: string
  referer: string
  status: number
}

export async function recordTraffic(hit: TrafficHit): Promise<void> {
  const ua = String(hit.ua || '').slice(0, 300)
  const bot = classifyBot(ua)
  const device = isMobileUa(ua) ? 'mobile' : 'desktop'
  const day = localDayKey()
  const salt = process.env.TRAFFIC_SALT || '2077-traffic'
  const ipHash = hashValue(salt + hit.ip)
  const visitor = hashValue(`${day}|${hit.ip}|${ua}|${salt}`)
  let referer = ''
  try {
    const r = new URL(hit.referer || '')
    referer = r.hostname.slice(0, 255)
  } catch {}
  const db = useDb()
  await db.execute(
    'INSERT INTO traffic_log (day, path, visitor, ip_hash, ua, is_bot, bot, device, referer, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [day, hit.path.slice(0, 255), visitor, ipHash, ua, bot ? 1 : 0, bot, device, referer, hit.status]
  )
}
