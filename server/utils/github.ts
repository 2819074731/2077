import { DEFAULT_GITHUB_SEARCH_RELAYS, type GithubSettings } from '#shared/siteSettings'
import { readBodyCapped, safeFetch } from './safeUrl'
import { getGithubSettings } from './githubSettings'
import { signGithubRawUrl } from './githubAsset'

const API = 'https://api.github.com'
const SEARCH_TTL = 5 * 60 * 1000
const RELEASE_TTL = 10 * 60 * 1000
const MAX_CACHE = 300
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
  defaultBranch: string
  homepage: string
  watchers: number
  avatar?: string
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

function tokenPool(): string[] {
  const raw = [process.env.GITHUB_TOKENS, process.env.GITHUB_TOKEN, process.env.GH_TOKEN]
    .filter(Boolean)
    .join(',')
  return [...new Set(raw.split(/[\s,]+/).map(value => value.trim()).filter(Boolean))]
}

let tokenCursor = 0

function nextToken(): string {
  const pool = tokenPool()
  if (!pool.length) return ''
  return pool[tokenCursor++ % pool.length] || ''
}

function apiHeaders(accept = 'application/vnd.github+json'): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': '2077Bot/1.0 (+https://my2077.com)',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  const t = nextToken()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

function relayHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': '2077Bot/1.0 (+https://my2077.com)'
  }
}

function searchRelays(settings: GithubSettings): string[] {
  if (settings.searchRelays.length) return settings.searchRelays
  const raw = process.env.GITHUB_SEARCH_RELAYS
  const values = raw ? raw.split(',') : DEFAULT_GITHUB_SEARCH_RELAYS
  const result: string[] = []
  for (const value of values) {
    try {
      const url = new URL(String(value).trim())
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) continue
      result.push(url.href.replace(/\/$/, ''))
    } catch {}
    if (result.length >= 6) break
  }
  return result
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

async function jsonFrom(
  url: string,
  options: { headers: Record<string, string>; timeout?: number; maxRedirects?: number }
): Promise<any> {
  const timeout = options.timeout || 12000
  const hit = await safeFetch(url, {
    timeout,
    maxRedirects: options.maxRedirects ?? 2,
    headers: options.headers
  })
  if (!hit) {
    throw createError({ statusCode: 502, statusMessage: '连接 GitHub 失败，请稍后重试' })
  }
  const { res } = hit
  let body: Buffer
  try {
    body = await readBodyCapped(res, 2 * 1024 * 1024, timeout)
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

async function ghJson(url: string, accept = 'application/vnd.github+json'): Promise<any> {
  return jsonFrom(url, { headers: apiHeaders(accept) })
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
    fork: !!item?.fork,
    defaultBranch: text(item?.default_branch, 120),
    homepage: text(item?.homepage, 300),
    watchers: Number(item?.watchers_count || item?.subscribers_count) || 0
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

function decorateSearchResult(result: GithubSearchResult, ttlSec: number): GithubSearchResult {
  return {
    ...result,
    items: result.items.map(item => ({
      ...item,
      avatar: item.id
        ? signGithubImageUrl(`https://avatars.githubusercontent.com/u/${item.id}?v=4`, ttlSec)
        : ''
    }))
  }
}

async function fetchSearchJson(
  params: URLSearchParams,
  settings: Awaited<ReturnType<typeof getGithubSettings>>
): Promise<any> {
  const queryString = params.toString()
  const attempts: Array<{
    label: string
    url: string
    headers: Record<string, string>
    timeout: number
    maxRedirects: number
  }> = [{
    label: 'github',
    url: `${API}/search/repositories?${queryString}`,
    headers: apiHeaders(),
    timeout: 12000,
    maxRedirects: 2
  }]

  if (settings.searchFallback) {
    for (const base of searchRelays(settings)) {
      attempts.push({
        label: base,
        url: `${base}/${API}/search/repositories?${queryString}`,
        headers: relayHeaders(),
        timeout: 9000,
        maxRedirects: 3
      })
    }
  }

  let firstError: any = null
  for (const attempt of attempts) {
    try {
      return await jsonFrom(attempt.url, {
        headers: attempt.headers,
        timeout: attempt.timeout,
        maxRedirects: attempt.maxRedirects
      })
    } catch (error: any) {
      if (!firstError) firstError = error
      if (error?.statusCode === 400) throw error
      if (attempt.label !== 'github') {
        console.warn('[github-search] relay failed:', attempt.label, error?.statusMessage || error?.message || error)
      }
    }
  }
  throw firstError || createError({ statusCode: 502, statusMessage: 'GitHub 暂时无法访问，请稍后重试' })
}

export async function searchGithub(
  query: string,
  page = 1,
  sort: 'best' | 'stars' | 'forks' | 'updated' = 'best'
): Promise<GithubSearchResult> {
  const q = normalizeGithubQuery(query)
  if (!q) throw createError({ statusCode: 400, statusMessage: '请输入搜索关键词' })
  const settings = await getGithubSettings()
  const perPage = Math.max(10, Math.min(30, Number(settings.pageSize) || 20))
  const maxPages = Math.max(1, Math.min(20, Number(settings.maxPages) || 20))
  const currentPage = Math.max(1, Math.min(maxPages, Number(page) || 1))
  const ttl = Math.max(60, Number(settings.searchCacheSec) || 300) * 1000
  const key = `${sort}:${currentPage}:${perPage}:${q.toLowerCase()}`

  const cached = cacheGet(searchCache, key, ttl)
  if (cached !== undefined) return decorateSearchResult(cached, settings.assetTtlSec)
  const running = searchInflight.get(key)
  if (running) return running

  const params = new URLSearchParams({
    q,
    per_page: String(perPage),
    page: String(currentPage)
  })
  if (sort !== 'best') {
    params.set('sort', sort)
    params.set('order', 'desc')
  }

  const task = fetchSearchJson(params, settings)
    .then((data) => {
      const result: GithubSearchResult = {
        items: Array.isArray(data?.items) ? data.items.map(normalizeRepo).filter((r: GithubRepo) => r.fullName) : [],
        total: Number(data?.total_count) || 0,
        incomplete: !!data?.incomplete_results,
        rateRemaining: null
      }
      cachePut(searchCache, key, result)
      return decorateSearchResult(result, settings.assetTtlSec)
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
  const settings = await getGithubSettings()
  const limitMB = kind === 'zip'
    ? Math.max(10, Number(settings.maxZipMB) || 512)
    : Math.max(10, Number(settings.maxAssetMB) || 512)
  const maxBytes = limitMB * 1024 * 1024

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
  if (length > maxBytes) {
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



export interface GithubTreeEntry {
  name: string
  path: string
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  size: number
  sha: string
}

export interface GithubFileContent {
  name: string
  path: string
  size: number
  sha: string
  kind: 'text' | 'image' | 'binary' | 'too-large'
  text: string
  truncated: boolean
  rawUrl: string
}

export interface GithubContents {
  type: 'dir' | 'file'
  path: string
  entries: GithubTreeEntry[]
  file: GithubFileContent | null
}

const repoCache = new Map<string, Entry<GithubRepo>>()
const contentsCache = new Map<string, Entry<GithubContents>>()
const repoInflight = new Map<string, Promise<GithubRepo>>()
const contentsInflight = new Map<string, Promise<GithubContents>>()

export function normalizeGithubPath(value: unknown): string {
  const raw = String(value ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!raw) return ''
  if (raw.length > 400) throw createError({ statusCode: 400, statusMessage: '文件路径过长' })
  const parts = raw.split('/').filter(Boolean)
  if (parts.some(part => part === '.' || part === '..' || part.includes('\u0000'))) {
    throw createError({ statusCode: 400, statusMessage: '文件路径不正确' })
  }
  return parts.join('/')
}

function encodeGithubPath(path: string): string {
  return path.split('/').filter(Boolean).map(part => encodeURIComponent(part)).join('/')
}

function fileKind(path: string, size: number, maxText: number, maxImage: number): 'image' | 'too-large' | 'text' {
  if (/\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i.test(path)) return size > maxImage ? 'too-large' : 'image'
  if (size > maxText) return 'too-large'
  return 'text'
}

function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000))
  if (sample.includes(0)) return true
  let control = 0
  for (const byte of sample) {
    if (byte < 7 || (byte > 13 && byte < 32)) control++
  }
  return sample.length > 0 && control / sample.length > 0.1
}

function decodeFileText(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return ''
  }
}

async function readTextFromUrl(url: string, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  const hit = await safeFetch(url, {
    timeout: 12000,
    maxRedirects: 3,
    headers: { 'User-Agent': '2077Bot/1.0 (+https://my2077.com)' }
  })
  if (!hit) throw createError({ statusCode: 502, statusMessage: '读取文件失败，请稍后重试' })
  if (!hit.res.ok) {
    try { await hit.res.body?.cancel() } catch {}
    throw createError({ statusCode: 502, statusMessage: '读取文件失败，请稍后重试' })
  }
  const buffer = await readBodyCapped(hit.res, maxBytes, 12000, true)
  return { text: buffer.toString('utf8'), truncated: buffer.length >= maxBytes }
}

export async function getGithubRepo(repo: string): Promise<GithubRepo> {
  const name = String(repo || '').trim()
  if (!isGithubRepo(name)) throw createError({ statusCode: 400, statusMessage: '仓库名格式不正确' })
  const settings = await getGithubSettings()
  const ttl = Math.max(60, Number(settings.repoCacheSec) || 300) * 1000
  const key = name.toLowerCase()

  const cached = cacheGet(repoCache, key, ttl)
  if (cached !== undefined) return cached
  const running = repoInflight.get(key)
  if (running) return running

  const task = ghJson(`${API}/repos/${name}`)
    .then((data) => {
      const result = normalizeRepo(data)
      cachePut(repoCache, key, result)
      return result
    })
    .finally(() => { repoInflight.delete(key) })

  repoInflight.set(key, task)
  return task
}

export async function getGithubContents(repo: string, pathValue: string): Promise<GithubContents> {
  const name = String(repo || '').trim()
  if (!isGithubRepo(name)) throw createError({ statusCode: 400, statusMessage: '仓库名格式不正确' })
  const path = normalizeGithubPath(pathValue)
  const settings = await getGithubSettings()
  const ttl = Math.max(60, Number(settings.repoCacheSec) || 300) * 1000
  const maxText = Math.max(64, Number(settings.filePreviewMaxKB) || 512) * 1024
  const maxImage = Math.max(1, Number(settings.imageMaxMB) || 20) * 1024 * 1024
  const key = `${name.toLowerCase()}:${path}`

  const cached = cacheGet(contentsCache, key, ttl)
  if (cached !== undefined) return cached
  const running = contentsInflight.get(key)
  if (running) return running

  const task = ghJson(`${API}/repos/${name}/contents${path ? '/' + encodeGithubPath(path) : ''}`)
    .then(async (data): Promise<GithubContents> => {
      if (Array.isArray(data)) {
        const entries: GithubTreeEntry[] = data
          .filter((item: any) => item?.name && ['file', 'dir', 'symlink', 'submodule'].includes(item?.type))
          .slice(0, 500)
          .map((item: any) => ({
            name: text(item.name, 200),
            path: text(item.path, 400),
            type: item.type,
            size: Number(item.size) || 0,
            sha: text(item.sha, 80)
          }))
          .sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1
            if (a.type !== 'dir' && b.type === 'dir') return 1
            return a.name.localeCompare(b.name, 'en')
          })
        const result: GithubContents = { type: 'dir', path, entries, file: null }
        cachePut(contentsCache, key, result)
        return result
      }

      if (!data || typeof data !== 'object' || !data.name) {
        throw createError({ statusCode: 404, statusMessage: '未找到该文件或目录' })
      }

      const size = Number(data.size) || 0
      const itemPath = normalizeGithubPath(data.path || path)
      let kind = fileKind(itemPath, size, maxText, maxImage)
      let contentText = ''
      let truncated = false

      if (kind === 'text' && data.type !== 'symlink' && data.type !== 'submodule') {
        if (data.content && data.encoding === 'base64') {
          const buffer = Buffer.from(String(data.content), 'base64')
          if (looksBinary(buffer)) {
            kind = 'binary'
          } else {
            contentText = decodeFileText(buffer)
            if (!contentText && buffer.length) kind = 'binary'
          }
        } else if (data.download_url && size <= maxText) {
          const remote = await readTextFromUrl(String(data.download_url), maxText)
          contentText = remote.text
          truncated = remote.truncated || size > maxText
        } else if (size > 0) {
          kind = 'too-large'
        }
      }

      const file: GithubFileContent = {
        name: text(data.name, 200),
        path: itemPath,
        size,
        sha: text(data.sha, 80),
        kind,
        text: contentText,
        truncated,
        rawUrl: signGithubRawUrl(name, itemPath, settings.assetTtlSec)
      }
      const result: GithubContents = { type: 'file', path: itemPath, entries: [], file }
      cachePut(contentsCache, key, result)
      return result
    })
    .finally(() => { contentsInflight.delete(key) })

  contentsInflight.set(key, task)
  return task
}

export async function openGithubRaw(repo: string, pathValue: string): Promise<GithubDownload> {
  const name = String(repo || '').trim()
  if (!isGithubRepo(name)) throw createError({ statusCode: 400, statusMessage: '仓库名格式不正确' })
  const path = normalizeGithubPath(pathValue)
  if (!path) throw createError({ statusCode: 400, statusMessage: '文件路径不能为空' })

  const settings = await getGithubSettings()
  const maxBytes = Math.max(1, Number(settings.rawMaxMB) || 20) * 1024 * 1024
  const detail = await getGithubRepo(name)
  const ref = detail.defaultBranch || 'HEAD'
  const url = `https://raw.githubusercontent.com/${name}/${encodeGithubPath(ref)}/${encodeGithubPath(path)}`
  const hit = await safeFetch(url, {
    timeout: 30000,
    maxRedirects: 3,
    headers: { 'User-Agent': '2077Bot/1.0 (+https://my2077.com)' }
  })
  if (!hit) throw createError({ statusCode: 502, statusMessage: '读取文件失败，请稍后重试' })

  const { res } = hit
  if (!res.ok) {
    try { await res.body?.cancel() } catch {}
    if (res.status === 404) throw createError({ statusCode: 404, statusMessage: '未找到该文件' })
    throw createError({ statusCode: 502, statusMessage: '读取文件失败，请稍后重试' })
  }

  const length = Number(res.headers.get('content-length') || 0)
  if (length > maxBytes) {
    try { await res.body?.cancel() } catch {}
    throw createError({ statusCode: 413, statusMessage: '文件过大，请直接到 GitHub 查看' })
  }

  const upstreamType = text(res.headers.get('content-type'), 80).split(';')[0].trim()
  return {
    response: res,
    filename: sanitizeFilename(path.split('/').pop() || 'file'),
    contentType: upstreamType || 'application/octet-stream',
    contentLength: Number.isFinite(length) && length > 0 ? length : 0
  }
}


export interface GithubReadme {
  path: string
  markdown: string
  truncated: boolean
  branch: string
}

export interface GithubIssueItem {
  number: number
  title: string
  state: string
  author: string
  avatar: string
  comments: number
  createdAt: string
  updatedAt: string
  labels: Array<{ name: string; color: string }>
  pullRequest: boolean
  body: string
}

export interface GithubCommitItem {
  sha: string
  shortSha: string
  message: string
  authorName: string
  authorLogin: string
  avatar: string
  date: string
  url: string
}

export interface GithubContributorItem {
  login: string
  avatar: string
  contributions: number
  url: string
}

export interface GithubBranchItem {
  name: string
  sha: string
  protected: boolean
}

export interface GithubTagItem {
  name: string
  sha: string
}

export interface GithubReleaseItem {
  id: number
  tag: string
  name: string
  body: string
  publishedAt: string
  prerelease: boolean
  draft: boolean
  author: string
  assets: GithubAsset[]
}

export interface GithubExploreResult {
  issues: GithubIssueItem[]
  pulls: GithubIssueItem[]
  commits: GithubCommitItem[]
  contributors: GithubContributorItem[]
  branches: GithubBranchItem[]
  tags: GithubTagItem[]
  releases: GithubReleaseItem[]
  partial: boolean
}

const readmeCache = new Map<string, Entry<GithubReadme | null>>()
const exploreCache = new Map<string, Entry<GithubExploreResult>>()

function avatarUrl(value: unknown): string {
  const url = String(value || '').trim()
  if (!url || !/^https:\/\//i.test(url)) return ''
  return url.slice(0, 300)
}

function normalizeIssue(item: any): GithubIssueItem | null {
  const number = Number(item?.number)
  if (!number) return null
  return {
    number,
    title: text(item?.title, 240),
    state: text(item?.state, 20) || 'open',
    author: text(item?.user?.login, 80),
    avatar: avatarUrl(item?.user?.avatar_url),
    comments: Number(item?.comments) || 0,
    createdAt: text(item?.created_at, 40),
    updatedAt: text(item?.updated_at, 40),
    labels: Array.isArray(item?.labels)
      ? item.labels.slice(0, 6).map((label: any) => ({ name: text(label?.name, 40), color: text(label?.color, 8) })).filter((label: any) => label.name)
      : [],
    pullRequest: !!item?.pull_request,
    body: text(item?.body, 400)
  }
}

export async function getGithubReadme(repo: string): Promise<GithubReadme | null> {
  const name = String(repo || '').trim()
  if (!isGithubRepo(name)) throw createError({ statusCode: 400, statusMessage: '仓库名格式不正确' })
  const settings = await getGithubSettings()
  const ttl = Math.max(60, Number(settings.readmeCacheSec) || 300) * 1000
  const maxBytes = Math.max(32, Number(settings.readmeMaxKB) || 256) * 1024
  const key = name.toLowerCase()

  const cached = cacheGet(readmeCache, key, ttl)
  if (cached !== undefined) return cached

  let data: any
  try {
    data = await ghJson(`${API}/repos/${name}/readme`)
  } catch (error: any) {
    if (error?.statusCode === 404) {
      cachePut(readmeCache, key, null)
      return null
    }
    throw error
  }
  if (!data || !data.path) {
    cachePut(readmeCache, key, null)
    return null
  }

  let markdown = ''
  let truncated = false
  const size = Number(data.size) || 0
  const detail = await getGithubRepo(name).catch(() => null)
  const branch = detail?.defaultBranch || 'HEAD'

  if (data.content && String(data.encoding).toLowerCase() === 'base64') {
    const buffer = Buffer.from(String(data.content), 'base64')
    truncated = buffer.length > maxBytes
    markdown = buffer.subarray(0, maxBytes).toString('utf8')
  } else if (data.download_url) {
    const hit = await safeFetch(String(data.download_url), {
      timeout: 12000,
      maxRedirects: 3,
      headers: { 'User-Agent': '2077Bot/1.0 (+https://my2077.com)' }
    })
    if (!hit || !hit.res.ok) {
      try { await hit?.res.body?.cancel() } catch {}
      throw createError({ statusCode: 502, statusMessage: '读取 README 失败，请稍后重试' })
    }
    const buffer = await readBodyCapped(hit.res, maxBytes, 12000, true)
    truncated = buffer.length >= maxBytes || size > maxBytes
    markdown = buffer.toString('utf8')
  }

  const result: GithubReadme = {
    path: text(data.path, 300),
    markdown,
    truncated,
    branch
  }
  cachePut(readmeCache, key, result)
  return result
}

async function exploreIssues(name: string): Promise<GithubIssueItem[]> {
  const data = await ghJson(`${API}/repos/${name}/issues?state=all&sort=updated&per_page=15`)
  return Array.isArray(data)
    ? data.map(normalizeIssue).filter((item): item is GithubIssueItem => !!item && !item.pullRequest)
    : []
}

async function explorePulls(name: string): Promise<GithubIssueItem[]> {
  const data = await ghJson(`${API}/repos/${name}/pulls?state=all&sort=updated&direction=desc&per_page=15`)
  return Array.isArray(data)
    ? data.map(normalizeIssue).filter((item): item is GithubIssueItem => !!item)
    : []
}

async function exploreCommits(name: string): Promise<GithubCommitItem[]> {
  const data = await ghJson(`${API}/repos/${name}/commits?per_page=15`)
  if (!Array.isArray(data)) return []
  return data.filter((item: any) => item?.sha).slice(0, 15).map((item: any) => ({
    sha: text(item.sha, 40),
    shortSha: text(item.sha, 40).slice(0, 7),
    message: text(String(item.commit?.message || '').split('\n')[0], 160),
    authorName: text(item.commit?.author?.name, 80),
    authorLogin: text(item.author?.login, 80),
    avatar: avatarUrl(item.author?.avatar_url),
    date: text(item.commit?.author?.date, 40),
    url: text(item.html_url, 300)
  }))
}

async function exploreContributors(name: string): Promise<GithubContributorItem[]> {
  const data = await ghJson(`${API}/repos/${name}/contributors?per_page=20`)
  if (!Array.isArray(data)) return []
  return data.filter((item: any) => item?.login).slice(0, 20).map((item: any) => ({
    login: text(item.login, 80),
    avatar: avatarUrl(item.avatar_url),
    contributions: Number(item.contributions) || 0,
    url: text(item.html_url, 300)
  }))
}

async function exploreBranches(name: string): Promise<GithubBranchItem[]> {
  const data = await ghJson(`${API}/repos/${name}/branches?per_page=100`)
  if (!Array.isArray(data)) return []
  return data.filter((item: any) => item?.name).slice(0, 100).map((item: any) => ({
    name: text(item.name, 120),
    sha: text(item.commit?.sha, 40),
    protected: !!item.protected
  }))
}

async function exploreTags(name: string): Promise<GithubTagItem[]> {
  const data = await ghJson(`${API}/repos/${name}/tags?per_page=50`)
  if (!Array.isArray(data)) return []
  return data.filter((item: any) => item?.name).slice(0, 50).map((item: any) => ({
    name: text(item.name, 80),
    sha: text(item.commit?.sha, 40)
  }))
}

async function exploreReleases(name: string): Promise<GithubReleaseItem[]> {
  const data = await ghJson(`${API}/repos/${name}/releases?per_page=10`)
  if (!Array.isArray(data)) return []
  return data.filter((item: any) => item?.tag_name).slice(0, 10).map((item: any) => {
    const release = normalizeRelease(item)
    return {
      id: Number(item.id) || 0,
      tag: release?.tag || text(item.tag_name, 80),
      name: release?.name || text(item.name || item.tag_name, 160),
      body: text(item.body, 1200),
      publishedAt: text(item.published_at, 40),
      prerelease: !!item.prerelease,
      draft: !!item.draft,
      author: text(item.author?.login, 80),
      assets: release?.assets || []
    }
  })
}

export type GithubExploreType = 'issues' | 'pulls' | 'commits' | 'contributors' | 'branches' | 'tags' | 'releases'

export async function getGithubExplore(repo: string, type: GithubExploreType): Promise<GithubExploreResult> {
  const name = String(repo || '').trim()
  if (!isGithubRepo(name)) throw createError({ statusCode: 400, statusMessage: '仓库名格式不正确' })
  const settings = await getGithubSettings()
  const ttl = Math.max(60, Number(settings.repoCacheSec) || 300) * 1000
  const key = `${name.toLowerCase()}:${type}`

  const cached = cacheGet(exploreCache, key, ttl)
  if (cached !== undefined) return cached

  let partial = false
  const pick = <T>(task: Promise<T[]>): Promise<T[]> => task.catch(() => { partial = true; return [] })

  const result: GithubExploreResult = {
    issues: [],
    pulls: [],
    commits: [],
    contributors: [],
    branches: [],
    tags: [],
    releases: [],
    partial: false
  }

  if (type === 'issues') result.issues = await pick(exploreIssues(name))
  else if (type === 'pulls') result.pulls = await pick(explorePulls(name))
  else if (type === 'commits') result.commits = await pick(exploreCommits(name))
  else if (type === 'contributors') result.contributors = await pick(exploreContributors(name))
  else if (type === 'branches') result.branches = await pick(exploreBranches(name))
  else if (type === 'tags') result.tags = await pick(exploreTags(name))
  else if (type === 'releases') result.releases = await pick(exploreReleases(name))

  result.partial = partial
  cachePut(exploreCache, key, result)
  return result
}
