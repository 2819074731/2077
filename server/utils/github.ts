import { readBodyCapped, safeFetch } from './safeUrl'

const API = 'https://api.github.com'
const SEARCH_TTL = 5 * 60 * 1000
const RELEASE_TTL = 10 * 60 * 1000
const MAX_CACHE = 300
const MAX_DOWNLOAD = 512 * 1024 * 1024
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export interface GithubRepo {
  id: number
  fullName: string
  owner: string
  name: string
  description: string
  stars: number
  forks: number
  issues: number
  language: string
  license: string
  topics: string[]
  updatedAt: string
  pushedAt: string
  archived: boolean
  fork: boolean
}

export interface GithubAsset {
  id: number
  name: string
  size: number
  downloads: number
  contentType: string
}

export interface GithubRelease {
  tag: string
  name: string
  publishedAt: string
  assets: GithubAsset[]
}

export interface GithubSearchResult {
  items: GithubRepo[]
  total: number
  incomplete: boolean
  rateRemaining: number | null
}

interface Entry<T> { value: T; at: number }

const searchCache = new Map<string, Entry<GithubSearchResult>>()
const releaseCache = new Map<string, Entry<GithubRelease | null>>()
const searchInflight = new Map<string, Promise<GithubSearchResult>>()
const releaseInflight = new Map<string, Promise<GithubRelease | null>>()

function token(): string {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
}

function apiHeaders(accept = 'application/vnd.github+json'): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': '2077Bot/1.0 (+https://my2077.com)',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  const t = token()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

function cacheGet<T>(map: Map<string, Entry<T>>, key: string, ttl: number): T | undefined {
  const hit = map.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > ttl) {
    map.delete(key)
    return undefined
  }
  return hit.value
}

function cachePut<T>(map: Map<string, Entry<T>>, key: string, value: T): void {
  if (map.size >= MAX_CACHE) {
    const oldest = map.keys().next().value
    if (oldest) map.delete(oldest)
  }
  map.set(key, { value, at: Date.now() })
}

function rateLimitError(res: Response): never {
  const remaining = res.headers.get('x-ratelimit-remaining')
  const reset = Number(res.headers.get('x-ratelimit-reset') || 0)
  const wait = reset > 0 ? Math.max(1, reset - Math.floor(Date.now() / 1000)) : 60
  const limited = res.status === 429 || (res.status === 403 && remaining === '0')
  if (limited) {
    throw createError({
      statusCode: 503,
      statusMessage: `GitHub 接口暂时受限，约 ${wait} 秒后恢复，请稍后再试`,
      data: { retryAfter: wait }
    })
  }
  if (res.status === 422) {
    throw createError({ statusCode: 400, statusMessage: '搜索语法无效，请调整关键词后重试' })
  }
  if (res.status === 404) {
    throw createError({ statusCode: 404, statusMessage: '未找到该仓库或 Release' })
  }
  throw createError({ statusCode: 502, statusMessage: 'GitHub 暂时无法访问，请稍后重试' })
}

async function ghJson(url: string, accept = 'application/vnd.github+json'): Promise<any> {
  const hit = await safeFetch(url, {
    timeout: 12000,
    maxRedirects: 2,
    headers: apiHeaders(accept)
  })
  if (!hit) {
    throw createError({ statusCode: 502, statusMessage: '连接 GitHub 失败，请稍后重试' })
  }
  const { res } = hit
  let body: Buffer
  try {
    body = await readBodyCapped(res, 2 * 1024 * 1024, 12000)
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'GitHub 返回内容异常' })
  }
  if (!res.ok) rateLimitError(res)
  try {
    return JSON.parse(body.toString('utf8'))
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'GitHub 返回内容解析失败' })
  }
}

function text(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function normalizeRepo(item: any): GithubRepo {
  const license = item?.license?.spdx_id && item.license.spdx_id !== 'NOASSERTION'
    ? item.license.spdx_id
    : text(item?.license?.name, 40)
  return {
    id: Number(item?.id) || 0,
    fullName: text(item?.full_name, 140),
    owner: text(item?.owner?.login, 80),
    name: text(item?.name, 100),
    description: text(item?.description, 300),
    stars: Number(item?.stargazers_count) || 0,
    forks: Number(item?.forks_count) || 0,
    issues: Number(item?.open_issues_count) || 0,
    language: text(item?.language, 40),
    license,
    topics: Array.isArray(item?.topics)
      ? item.topics.filter((t: unknown) => typeof t === 'string').map((t: string) => text(t, 30)).slice(0, 6)
      : [],
    updatedAt: text(item?.updated_at, 40),
    pushedAt: text(item?.pushed_at, 40),
    archived: !!item?.archived,
    fork: !!item?.fork
  }
}

export function isGithubRepo(value: string): boolean {
  const repo = String(value || '').trim()
  if (!repo || repo.length > 140 || !REPO_RE.test(repo)) return false
  return repo.split('/').every(part => part !== '.' && part !== '..')
}

export function normalizeGithubQuery(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export async function searchGithub(
  query: string,
  page = 1,
  sort: 'best' | 'stars' | 'forks' | 'updated' = 'best'
): Promise<GithubSearchResult> {
  const q = normalizeGithubQuery(query)
  if (!q) throw createError({ statusCode: 400, statusMessage: '请输入搜索关键词' })
  const currentPage = Math.max(1, Math.min(20, Number(page) || 1))
  const key = `${sort}:${currentPage}:${q.toLowerCase()}`

  const cached = cacheGet(searchCache, key, SEARCH_TTL)
  if (cached !== undefined) return cached
  const running = searchInflight.get(key)
  if (running) return running

  const params = new URLSearchParams({
    q,
    per_page: '20',
    page: String(currentPage)
  })
  if (sort !== 'best') {
    params.set('sort', sort)
    params.set('order', 'desc')
  }

  const task = ghJson(`${API}/search/repositories?${params.toString()}`)
    .then((data) => {
      const result: GithubSearchResult = {
        items: Array.isArray(data?.items) ? data.items.map(normalizeRepo).filter((r: GithubRepo) => r.fullName) : [],
        total: Number(data?.total_count) || 0,
        incomplete: !!data?.incomplete_results,
        rateRemaining: null
      }
      cachePut(searchCache, key, result)
      return result
    })
    .finally(() => { searchInflight.delete(key) })

  searchInflight.set(key, task)
  return task
}

function normalizeRelease(data: any): GithubRelease | null {
  if (!data || !data.tag_name) return null
  const assets = Array.isArray(data.assets)
    ? data.assets
      .filter((a: any) => Number(a?.id) > 0 && a?.name)
      .slice(0, 20)
      .map((a: any) => ({
        id: Number(a.id),
        name: text(a.name, 160),
        size: Number(a.size) || 0,
        downloads: Number(a.download_count) || 0,
        contentType: text(a.content_type, 80)
      }))
    : []
  return {
    tag: text(data.tag_name, 80),
    name: text(data.name || data.tag_name, 160),
    publishedAt: text(data.published_at, 40),
    assets
  }
}

export async function getGithubRelease(repo: string): Promise<GithubRelease | null> {
  const name = String(repo || '').trim()
  if (!isGithubRepo(name)) throw createError({ statusCode: 400, statusMessage: '仓库名格式不正确' })
  const key = name.toLowerCase()

  const cached = cacheGet(releaseCache, key, RELEASE_TTL)
  if (cached !== undefined) return cached
  const running = releaseInflight.get(key)
  if (running) return running

  const task = ghJson(`${API}/repos/${name}/releases/latest`)
    .then((data) => {
      const release = normalizeRelease(data)
      cachePut(releaseCache, key, release)
      return release
    })
    .catch((error: any) => {
      if (error?.statusCode === 404) {
        cachePut(releaseCache, key, null)
        return null
      }
      throw error
    })
    .finally(() => { releaseInflight.delete(key) })

  releaseInflight.set(key, task)
  return task
}

function sanitizeFilename(value: string): string {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

function dispositionFilename(value: string | null): string {
  if (!value) return ''
  const utf8 = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (utf8) {
    try { return sanitizeFilename(decodeURIComponent(utf8)) } catch {}
  }
  const plain = value.match(/filename="?([^";]+)"?/i)?.[1]
  return sanitizeFilename(plain || '')
}

export interface GithubDownload {
  response: Response
  filename: string
  contentType: string
  contentLength: number
}

export async function openGithubDownload(
  repo: string,
  kind: 'zip' | 'asset',
  assetId = '',
  requestedName = ''
): Promise<GithubDownload> {
  const name = String(repo || '').trim()
  if (!isGithubRepo(name)) throw createError({ statusCode: 400, statusMessage: '仓库名格式不正确' })

  let url: string
  let accept: string
  let fallback: string

  if (kind === 'zip') {
    url = `https://codeload.github.com/${name}/zip/HEAD`
    accept = 'application/zip'
    fallback = `${name.split('/')[1]}-HEAD.zip`
  } else {
    if (!/^\d{1,20}$/.test(String(assetId))) {
      throw createError({ statusCode: 400, statusMessage: '文件编号不正确' })
    }
    url = `${API}/repos/${name}/releases/assets/${assetId}`
    accept = 'application/octet-stream'
    fallback = sanitizeFilename(requestedName) || `github-asset-${assetId}`
  }

  const headers = { Accept: accept, 'User-Agent': '2077Bot/1.0 (+https://my2077.com)' }
  const hit = await safeFetch(url, {
    timeout: 30000,
    maxRedirects: 6,
    headers
  })
  if (!hit) throw createError({ statusCode: 502, statusMessage: '连接 GitHub 下载地址失败' })

  const { res } = hit
  if (!res.ok) {
    try { await res.body?.cancel() } catch {}
    rateLimitError(res)
  }

  const length = Number(res.headers.get('content-length') || 0)
  if (length > MAX_DOWNLOAD) {
    try { await res.body?.cancel() } catch {}
    throw createError({ statusCode: 413, statusMessage: '文件过大，暂不支持本站代理下载' })
  }

  const upstreamType = text(res.headers.get('content-type'), 80).split(';')[0].trim()
  const filename = dispositionFilename(res.headers.get('content-disposition'))
    || sanitizeFilename(requestedName)
    || fallback
  const contentType = kind === 'zip'
    ? 'application/zip'
    : (upstreamType && !/^text\/html/i.test(upstreamType) ? upstreamType : 'application/octet-stream')

  return {
    response: res,
    filename,
    contentType,
    contentLength: Number.isFinite(length) && length > 0 ? length : 0
  }
}

