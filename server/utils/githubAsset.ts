import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import type { GithubSettings } from '#shared/siteSettings'

const IMAGE_HOSTS = new Set([
  'avatars.githubusercontent.com',
  'camo.githubusercontent.com',
  'github.com',
  'media.githubusercontent.com',
  'objects.githubusercontent.com',
  'private-user-images.githubusercontent.com',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com'
])

function secret(): string {
  return process.env.GITHUB_ASSET_SECRET
    || process.env.SESSION_SECRET
    || process.env.NUXT_SESSION_SECRET
    || 'my2077-github-asset'
}

function digest(kind: string, target: string, exp: number): string {
  return createHmac('sha256', secret())
    .update(`${kind}\n${exp}\n${target}`)
    .digest('base64url')
}

export function signGithubAsset(kind: 'raw' | 'image', target: string, ttlSec: number): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + Math.max(30, Math.min(3600, Math.round(ttlSec || 600)))
  return { exp, sig: digest(kind, target, exp) }
}

export function githubRawTarget(repo: string, path: string): string {
  return `raw\n${repo}\n${path}`
}

export function signGithubRawUrl(repo: string, path: string, ttlSec: number): string {
  const signed = signGithubAsset('raw', githubRawTarget(repo, path), ttlSec)
  const params = new URLSearchParams({
    repo,
    path,
    exp: String(signed.exp),
    sig: signed.sig
  })
  return `/api/github/raw?${params.toString()}`
}

export function signGithubImageUrl(url: string, ttlSec: number): string {
  const signed = signGithubAsset('image', url, ttlSec)
  const params = new URLSearchParams({
    url,
    exp: String(signed.exp),
    sig: signed.sig
  })
  return `/api/github/image?${params.toString()}`
}

export function verifyGithubAsset(kind: 'raw' | 'image', target: string, expValue: unknown, sigValue: unknown): boolean {
  const exp = Number(expValue)
  if (!Number.isSafeInteger(exp) || exp < Math.floor(Date.now() / 1000) - 30) return false
  const got = String(sigValue || '')
  if (!got) return false
  const expected = digest(kind, target, exp)
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function siteHost(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const raw = String(config.public.siteUrl || '')
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function normalizeHost(value: string): string {
  let text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  text = text.replace(/^\*\./, '').replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] || ''
  if (text === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return text
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(text)) return ''
  return text
}

function hostAllowed(host: string, entries: string[]): boolean {
  const target = host.toLowerCase()
  return entries.some((entry) => {
    const clean = normalizeHost(entry)
    if (!clean) return false
    return target === clean || target.endsWith(`.${clean}`)
  })
}

function refererAllowed(event: H3Event, settings: GithubSettings): boolean {
  const raw = String(getHeader(event, 'referer') || '').trim()
  if (!raw) {
    return settings.allowEmptyReferer || (process.env.NODE_ENV !== 'production' && !settings.antiHotlink)
  }
  let host = ''
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return false
  }
  if (!host) return false
  const site = siteHost(event)
  const bare = site.replace(/^www\./, '')
  const aliases = [site, bare, bare ? `www.${bare}` : ''].filter(Boolean)
  if (aliases.includes(host)) return true
  if (process.env.NODE_ENV !== 'production' && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]')) return true
  const entries = [...aliases, ...String(settings.refererWhitelist || '').split(/[\s,]+/)]
  return hostAllowed(host, entries.filter(Boolean))
}

export function assertGithubReferer(event: H3Event, settings: GithubSettings): void {
  if (!settings.antiHotlink) return
  if (!refererAllowed(event, settings)) {
    throw createError({ statusCode: 403, statusMessage: '该资源仅限本站页面访问' })
  }
}

export function assertGithubAssetAccess(
  event: H3Event,
  kind: 'raw' | 'image',
  target: string,
  settings: GithubSettings
): void {
  if (!settings.antiHotlink) return
  if (!verifyGithubAsset(kind, target, getQuery(event).exp, getQuery(event).sig)) {
    throw createError({ statusCode: 403, statusMessage: '图片链接已失效，请刷新页面重试' })
  }
  if (!refererAllowed(event, settings)) {
    throw createError({ statusCode: 403, statusMessage: '该资源仅限本站页面访问' })
  }
}

export function isGithubImageHost(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (parsed.username || parsed.password || parsed.port) return false
    return IMAGE_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
