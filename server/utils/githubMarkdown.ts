import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'
import { posix } from 'node:path'
import { isGithubImageHost, signGithubImageUrl, signGithubRawUrl } from './githubAsset'

interface RenderOptions {
  repo: string
  branch: string
  readmePath: string
  assetTtlSec: number
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section'
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  typographer: false
})

md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]!
  const inline = tokens[idx + 1]
  if (inline?.type === 'inline') token.attrSet('id', slugify(inline.content))
  return self.renderToken(tokens, idx, options)
}

function repoParts(repo: string): { owner: string; name: string } {
  const [owner = '', name = ''] = repo.split('/')
  return { owner, name }
}

function repoBase(repo: string, branch: string): string {
  return `https://github.com/${repo}/blob/${encodeURIComponent(branch)}/`
}

function relativeRepoPath(readmePath: string, src: string): string {
  const dir = posix.dirname(readmePath || 'README.md')
  const clean = String(src || '').split('#')[0]?.split('?')[0] || ''
  if (!clean) return ''
  if (clean.startsWith('/')) return posix.normalize(clean).replace(/^\/+/, '')
  const resolved = posix.normalize(posix.join(dir, clean))
  if (!resolved || resolved === '.' || resolved.startsWith('../')) return ''
  return resolved.replace(/^\/+/, '')
}

function internalPath(repo: string, branch: string, href: string): string {
  const { owner, name } = repoParts(repo)
  let parsed: URL
  try {
    parsed = new URL(href, repoBase(repo, branch))
  } catch {
    return ''
  }
  if (parsed.hostname !== 'github.com') return ''
  let parts: string[]
  try {
    parts = parsed.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  } catch {
    return ''
  }
  if (parts[0]?.toLowerCase() !== owner.toLowerCase() || parts[1]?.toLowerCase() !== name.toLowerCase()) return ''
  const kind = parts[2]
  if (kind === 'blob' || kind === 'tree') {
    const path = parts.slice(4).join('/')
    return `/github/${encodeURIComponent(owner)}/${encodeURIComponent(name)}${path ? `?path=${encodeURIComponent(path)}` : ''}`
  }
  if (kind === 'issues') return `/github/${encodeURIComponent(owner)}/${encodeURIComponent(name)}?tab=issues`
  if (kind === 'pulls' || kind === 'pull') return `/github/${encodeURIComponent(owner)}/${encodeURIComponent(name)}?tab=pulls`
  if (kind === 'releases') return `/github/${encodeURIComponent(owner)}/${encodeURIComponent(name)}?tab=releases`
  if (kind === 'commits' || kind === 'commit') return `/github/${encodeURIComponent(owner)}/${encodeURIComponent(name)}?tab=commits`
  return ''
}

function rewriteLink(href: string, opts: RenderOptions): string {
  const value = String(href || '').trim()
  if (!value || value.startsWith('#')) return value
  if (/^(mailto|tel):/i.test(value)) return value
  if (/^https?:\/\//i.test(value)) return internalPath(opts.repo, opts.branch, value) || value
  if (value.startsWith('//')) return `https:${value}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return ''
  const internal = internalPath(opts.repo, opts.branch, value)
  if (internal) return internal
  const path = relativeRepoPath(opts.readmePath, value)
  if (path) {
    const { owner, name } = repoParts(opts.repo)
    return `/github/${encodeURIComponent(owner)}/${encodeURIComponent(name)}?path=${encodeURIComponent(path)}`
  }
  try {
    const absolute = new URL(value, repoBase(opts.repo, opts.branch))
    if (absolute.hostname === 'github.com' || absolute.hostname === 'raw.githubusercontent.com') return absolute.href
  } catch {}
  return value
}

function rewriteImage(src: string, opts: RenderOptions): string {
  const value = String(src || '').trim()
  if (!value || /^data:/i.test(value)) return ''
  if (value.startsWith('//')) return `https:${value}`
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    const path = relativeRepoPath(opts.readmePath, value)
    if (path) return signGithubRawUrl(opts.repo, path, opts.assetTtlSec)
    try {
      const absolute = new URL(value, repoBase(opts.repo, opts.branch))
      if (isGithubImageHost(absolute.href)) return signGithubImageUrl(absolute.href, opts.assetTtlSec)
      return absolute.href
    } catch {
      return ''
    }
  }
  if (!/^https?:/i.test(value)) return ''
  if (!isGithubImageHost(value)) return value
  return signGithubImageUrl(value, opts.assetTtlSec)
}

const ALLOWED_TAGS = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'del', 'details', 'div',
  'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
  'i', 'img', 'input', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'picture', 'pre', 'q',
  's', 'samp', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody',
  'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'var'
]

export function renderGithubMarkdown(markdown: string, opts: RenderOptions): string {
  const source = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .slice(0, 600 * 1024)
    .replace(/^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)\[([ xX])\]([ \t]+)/gm, (_match, prefix: string, mark: string, space: string) => {
      return `${prefix}<input type="checkbox" disabled${mark.toLowerCase() === 'x' ? ' checked' : ''}>${space}`
    })
  const rendered = md.render(source)
  return sanitizeHtml(rendered, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'referrerpolicy'],
      code: ['class'],
      pre: ['class'],
      input: ['type', 'checked', 'disabled'],
      details: ['open'],
      div: ['align'],
      p: ['align'],
      h1: ['id', 'align'],
      h2: ['id', 'align'],
      h3: ['id', 'align'],
      h4: ['id', 'align'],
      h5: ['id', 'align'],
      h6: ['id', 'align'],
      table: ['align'],
      th: ['align', 'colspan', 'rowspan'],
      td: ['align', 'colspan', 'rowspan']
    },
    allowedClasses: {
      code: ['language-*'],
      pre: ['highlight']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: (tagName, attribs) => {
        const href = rewriteLink(attribs.href || '', opts)
        const next: Record<string, string> = { ...attribs, href }
        if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
          next.target = '_blank'
          next.rel = 'noopener noreferrer nofollow'
        } else {
          delete next.target
          delete next.rel
        }
        return { tagName, attribs: next }
      },
      img: (_tagName, attribs) => {
        const next: Record<string, string> = {
          src: rewriteImage(attribs.src || '', opts),
          alt: attribs.alt || '',
          loading: 'lazy',
          decoding: 'async'
        }
        if (attribs.title) next.title = attribs.title
        if (attribs.width && /^\d{1,4}$/.test(attribs.width)) next.width = attribs.width
        if (attribs.height && /^\d{1,4}$/.test(attribs.height)) next.height = attribs.height
        if (!next.src) return { tagName: 'span', attribs: {} }
        if (!/^\/api\/github\//.test(next.src)) next.referrerpolicy = 'no-referrer'
        return { tagName: 'img', attribs: next }
      },
      input: (tagName, attribs) => {
        if (String(attribs.type || '').toLowerCase() !== 'checkbox') return { tagName: 'span', attribs: {} }
        return {
          tagName,
          attribs: {
            type: 'checkbox',
            ...(Object.prototype.hasOwnProperty.call(attribs, 'checked') ? { checked: 'checked' } : {}),
            disabled: 'disabled'
          }
        }
      }
    },
    exclusiveFilter: frame => frame.tag === 'span' && !frame.text && !frame.mediaChildren.length
  })
}
