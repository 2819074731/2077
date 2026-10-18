import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { safeFetch } from './safeUrl'

const TOKEN_FILE = join(process.cwd(), 'data', 'github-tokens.json')
const TOKEN_RE = /^[A-Za-z0-9_]{20,255}$/
export const MAX_STORED_GITHUB_TOKENS = 10

interface TokenStore {
  tokens: string[]
  updatedAt?: string
}

export interface GithubQuotaBucket {
  limit: number
  remaining: number
  reset: number
  used: number
}

export interface GithubTokenQuota {
  valid: boolean
  core: GithubQuotaBucket | null
  search: GithubQuotaBucket | null
}

export function normalizeGithubToken(value: unknown): string {
  const token = String(value ?? '').trim()
  return TOKEN_RE.test(token) ? token : ''
}

export function maskGithubToken(token: string): string {
  if (token.length <= 12) return `${token.slice(0, 4)}…`
  return `${token.slice(0, 7)}…${token.slice(-4)}`
}

function uniqueTokens(values: string[]): string[] {
  return [...new Set(values.map(normalizeGithubToken).filter(Boolean))]
}

export function getEnvGithubTokens(): string[] {
  const raw = [process.env.GITHUB_TOKENS, process.env.GITHUB_TOKEN, process.env.GH_TOKEN]
    .filter(Boolean)
    .join(',')
  return uniqueTokens(raw.split(/[\s,]+/))
}

function readStoredTokensSync(): string[] {
  try {
    const statInfo = statSync(TOKEN_FILE)
    if (!statInfo.isFile() || statInfo.size > 64 * 1024) return []
    const parsed = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'))
    if (!parsed || !Array.isArray(parsed.tokens)) return []
    return uniqueTokens(parsed.tokens).slice(0, MAX_STORED_GITHUB_TOKENS)
  } catch {
    return []
  }
}

export async function readStoredGithubTokens(): Promise<string[]> {
  try {
    const info = await stat(TOKEN_FILE)
    if (!info.isFile() || info.size > 64 * 1024) return []
    const parsed = JSON.parse(await readFile(TOKEN_FILE, 'utf8')) as TokenStore
    if (!parsed || !Array.isArray(parsed.tokens)) return []
    return uniqueTokens(parsed.tokens).slice(0, MAX_STORED_GITHUB_TOKENS)
  } catch {
    return []
  }
}

export function getGithubTokens(): string[] {
  const stored = readStoredTokensSync()
  return stored.length ? stored : getEnvGithubTokens()
}

export function getGithubTokenSource(): 'file' | 'env' | 'none' {
  if (readStoredTokensSync().length) return 'file'
  return getEnvGithubTokens().length ? 'env' : 'none'
}

export async function saveGithubTokens(tokens: string[]): Promise<string[]> {
  const next = uniqueTokens(tokens).slice(0, MAX_STORED_GITHUB_TOKENS)
  await mkdir(dirname(TOKEN_FILE), { recursive: true })
  const temp = `${TOKEN_FILE}.tmp`
  await writeFile(temp, JSON.stringify({ tokens: next, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 })
  await chmod(temp, 0o600)
  await rename(temp, TOKEN_FILE)
  return next
}

function bucket(value: any): GithubQuotaBucket | null {
  if (!value || typeof value !== 'object') return null
  return {
    limit: Number(value.limit) || 0,
    remaining: Number(value.remaining) || 0,
    reset: Number(value.reset) || 0,
    used: Number(value.used) || 0
  }
}

export async function fetchGithubQuota(token: string): Promise<GithubTokenQuota> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': '2077Bot/1.0 (+https://my2077.com)',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const hit = await safeFetch('https://api.github.com/rate_limit', { timeout: 8000, headers })
  if (!hit) throw createError({ statusCode: 502, statusMessage: '无法连接 GitHub 校验 Token，请稍后重试' })
  const { res } = hit
  if (res.status === 401) {
    try { await res.body?.cancel() } catch {}
    return { valid: false, core: null, search: null }
  }
  if (!res.ok) {
    try { await res.body?.cancel() } catch {}
    throw createError({ statusCode: 502, statusMessage: 'GitHub 暂时无法校验 Token，请稍后重试' })
  }
  let data: any
  try {
    data = await res.json()
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'GitHub 返回内容异常' })
  }
  return {
    valid: true,
    core: bucket(data?.resources?.core),
    search: bucket(data?.resources?.search)
  }
}

export interface GithubTokenAdminStatus {
  source: 'file' | 'env' | 'none'
  activeCount: number
  storedCount: number
  envCount: number
  tokens: Array<{ index: number; masked: string }>
  quota: GithubTokenQuota | null
  quotaError: string
}

export async function getGithubTokenAdminStatus(): Promise<GithubTokenAdminStatus> {
  const stored = await readStoredGithubTokens()
  const env = getEnvGithubTokens()
  const active = stored.length ? stored : env
  const source: 'file' | 'env' | 'none' = stored.length ? 'file' : env.length ? 'env' : 'none'
  let quota: GithubTokenQuota | null = null
  let quotaError = ''
  try {
    quota = await fetchGithubQuota(active[0] || '')
  } catch (error: any) {
    quotaError = error?.statusMessage || error?.message || '额度读取失败'
  }
  return {
    source,
    activeCount: active.length,
    storedCount: stored.length,
    envCount: env.length,
    tokens: stored.map((token, index) => ({ index, masked: maskGithubToken(token) })),
    quota,
    quotaError
  }
}
