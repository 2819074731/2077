import { setDefaultResultOrder } from 'node:dns'

try {
  setDefaultResultOrder('ipv4first')
} catch {}

export interface HotSearchResult {
  items: string[]
  live: boolean
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_TTL = 10 * 60 * 1000
const MAX_ITEMS = 10

const FALLBACK: Record<string, string[]> = {
  bing: ['AI 编程', '开源模型', '独立开发', '效率工具', '浏览器插件', '云服务器', '网络安全', '前端框架', '数据库', '在线协作'],
  google: ['OpenAI', 'DeepSeek', 'ChatGPT', 'Claude', 'GitHub', 'React', 'TypeScript', 'Linux', 'Docker', 'Kubernetes'],
  baidu: ['今日热点', '天气预报', '人工智能', '新能源汽车', '黄金价格', '科技新闻', '电影票房', '旅游攻略', '数码产品', '健康养生'],
  ddg: ['Open source', 'Privacy', 'AI tools', 'Web development', 'Linux', 'Rust', 'Python', 'Self-hosted', 'VPN', 'Digital nomad'],
  github: ['trending', 'awesome lists', 'machine learning', 'developer tools', 'nuxt', 'typescript', 'rust', 'llm', 'self-hosted', 'cli'],
  bilibili: ['影视飓风', '科技美学', '何同学', '罗翔说刑法', '原神', '崩坏：星穹铁道', '英雄联盟', '数码产品测评', '美食探店', '学习'],
  zhihu: ['人工智能', '职场发展', '考研', '编程', '数码产品', '电影推荐', '心理学', '健身', '理财', '留学'],
  weibo: ['今日热搜', '社会新闻', '娱乐八卦', '体育赛事', '电影票房', '科技数码', '美食', '旅游', '穿搭', '萌宠'],
  xiaohongshu: ['秋日穿搭', 'citywalk', '小户型收纳', '通勤妆容', '露营装备', '咖啡店探店', '减脂餐', '旅行攻略', '好物分享', '拍照姿势'],
  douyin: ['今日热点', '搞笑日常', '美食探店', '旅行风景', '萌宠', '健身教程', '影视剪辑', '生活技巧', '数码测评', '音乐'],
  douban: ['热门电影', '高分剧集', '豆瓣榜单', '书评', '影评', '纪录片', '综艺', '动画', '音乐', '同城活动'],
  youtube: ['trending', 'music', 'gaming', 'tech reviews', 'AI', 'coding', 'vlog', 'news', 'movies', 'sports']
}

const ENGINE_IDS = new Set([
  'bing', 'google', 'baidu', 'ddg', 'github', 'bilibili',
  'zhihu', 'weibo', 'xiaohongshu', 'douyin', 'douban', 'youtube'
])

const cache = new Map<string, HotSearchResult & { at: number }>()
const inflight = new Map<string, Promise<HotSearchResult>>()

interface FetchStatus {
  checkedAt: number
  live: boolean
  items: number
  error: string
}

const statuses = new Map<string, FetchStatus>()

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function clean(list: unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const text = String(raw ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^#+|#+$/g, '')
      .trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

async function request(url: string, headers: Record<string, string> = {}, timeout = 8000): Promise<Response | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...headers
      }
    })
    return res.ok ? res : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  const res = await request(url, { Accept: 'application/json, text/plain, */*', ...headers })
  if (!res) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function getText(url: string, headers: Record<string, string> = {}): Promise<string | null> {
  const res = await request(url, { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', ...headers })
  if (!res) return null
  try {
    return await res.text()
  } catch {
    return null
  }
}

async function baidu(): Promise<string[]> {
  const data = await getJson('https://top.baidu.com/api/board?platform=wise&tab=realtime', {
    Referer: 'https://top.baidu.com/board?tab=realtime'
  })
  const cards = Array.isArray(data?.data?.cards) ? data.data.cards : []
  const words = cards.flatMap((card: any) =>
    Array.isArray(card?.content)
      ? card.content.flatMap((group: any) =>
        Array.isArray(group?.content) ? group.content.map((item: any) => item?.word) : []
      )
      : []
  )
  return clean(words)
}

async function weibo(): Promise<string[]> {
  const data = await getJson('https://weibo.com/ajax/side/hotSearch', {
    Referer: 'https://weibo.com/',
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json, text/plain, */*'
  })
  const list = Array.isArray(data?.data?.realtime) ? data.data.realtime : []
  return clean(list.filter((item: any) => item?.word && !item?.is_ad).map((item: any) => item.word))
}

async function zhihu(): Promise<string[]> {
  const data = await getJson('https://api.zhihu.com/topstory/hot-list?limit=20', {
    Referer: 'https://www.zhihu.com/'
  })
  const list = Array.isArray(data?.data) ? data.data : []
  return clean(list.map((item: any) => item?.target?.title))
}

async function bilibili(): Promise<string[]> {
  const data = await getJson('https://api.bilibili.com/x/web-interface/search/square?limit=20', {
    Referer: 'https://www.bilibili.com/',
    Origin: 'https://www.bilibili.com'
  })
  const list = Array.isArray(data?.data?.trending?.list) ? data.data.trending.list : []
  return clean(list.map((item: any) => item?.show_name || item?.keyword))
}

async function douyin(): Promise<string[]> {
  const data = await getJson('https://www.douyin.com/aweme/v1/web/hot/search/list/', {
    Referer: 'https://www.douyin.com/'
  })
  const list = Array.isArray(data?.data?.word_list) ? data.data.word_list : []
  return clean(list.map((item: any) => item?.word))
}

async function douban(): Promise<string[]> {
  const data = await getJson('https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%83%AD%E9%97%A8&page_limit=20&page_start=0', {
    Referer: 'https://movie.douban.com/'
  })
  const list = Array.isArray(data?.subjects) ? data.subjects : []
  return clean(list.map((item: any) => item?.title))
}

async function google(): Promise<string[]> {
  const xml = await getText('https://trends.google.com/trending/rss?geo=HK', {
    Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
  })
  if (!xml) return []
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  const titles = items.map((m) => {
    const title = m[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''
    return decodeXml(title).replace(/^<!\[CDATA\[|\]\]>$/g, '').trim()
  })
  return clean(titles)
}

async function github(): Promise<string[]> {
  const html = await getText('https://github.com/trending')
  if (!html) return []
  const repos: string[] = []
  for (const chunk of html.split('<article').slice(1)) {
    const heading = chunk.match(/<h2[\s\S]*?href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"/)
    if (heading) repos.push(heading[1])
    if (repos.length >= MAX_ITEMS) break
  }
  return clean(repos)
}

const PROVIDERS: Record<string, () => Promise<string[]>> = {
  baidu,
  weibo,
  zhihu,
  bilibili,
  douyin,
  douban,
  google,
  github
}

export async function getHotSearch(engine: string, force = false): Promise<HotSearchResult> {
  const id = String(engine || 'bing').toLowerCase()
  if (!ENGINE_IDS.has(id)) {
    return { items: clean(FALLBACK.bing), live: false }
  }

  const hit = cache.get(id)
  if (!force && hit && Date.now() - hit.at < CACHE_TTL) {
    return { items: hit.items, live: hit.live }
  }

  const running = inflight.get(id)
  if (running && !force) return running

  const task = (async (): Promise<HotSearchResult> => {
    let items: string[] = []
    let error = ''
    if (PROVIDERS[id]) {
      try {
        items = await PROVIDERS[id]()
      } catch (e: any) {
        error = String(e?.message || '抓取失败').slice(0, 120)
      }
    }
    const live = items.length > 0
    if (!live) {
      items = clean(FALLBACK[id] || FALLBACK.bing)
      if (!error) error = PROVIDERS[id] ? '抓取结果为空，已使用内置词条' : '暂无实时来源，已使用内置词条'
    }
    const result = { items, live }
    if (items.length) cache.set(id, { ...result, at: Date.now() })
    statuses.set(id, { checkedAt: Date.now(), live, items: items.length, error })
    return result
  })().finally(() => inflight.delete(id))

  inflight.set(id, task)
  return task
}

export interface HotSearchStatus {
  engine: string
  provider: boolean
  live: boolean
  items: number
  checkedAt: number | null
  ageSeconds: number | null
  cached: boolean
  error: string
}

export function getHotSearchStatuses(engines: string[]): HotSearchStatus[] {
  return engines.map((raw) => {
    const id = String(raw || '').toLowerCase()
    const hit = cache.get(id)
    const status = statuses.get(id)
    return {
      engine: id,
      provider: !!PROVIDERS[id],
      live: status?.live ?? hit?.live ?? false,
      items: hit?.items.length ?? 0,
      checkedAt: status?.checkedAt ?? null,
      ageSeconds: hit ? Math.round((Date.now() - hit.at) / 1000) : null,
      cached: !!hit && Date.now() - hit.at < CACHE_TTL,
      error: status?.error || ''
    }
  })
}
