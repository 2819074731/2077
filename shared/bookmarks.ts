export interface BookmarkLink { name: string; url: string }
export interface BookmarkFolder { folder: string; links: BookmarkLink[] }

function decode(s: string): string {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 解析 Chrome / Edge / Firefox 导出的 Netscape 书签 HTML。
 * 以 <H3> 作为文件夹名，按 <DL> 嵌套维护层级，最终按最深层文件夹聚合。
 */
export function parseBookmarksHtml(html: string): BookmarkFolder[] {
  const token = /<h3[^>]*>([\s\S]*?)<\/h3>|<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>|<dl\b[^>]*>|<\/dl>/gi
  const stack: string[] = []
  let pending = ''
  const map = new Map<string, BookmarkLink[]>()
  let m: RegExpExecArray | null

  while ((m = token.exec(html))) {
    const raw = m[0]
    if (/^<dl/i.test(raw)) {
      stack.push(pending || '未分类')
      pending = ''
      continue
    }
    if (/^<\/dl/i.test(raw)) {
      stack.pop()
      continue
    }
    if (m[1] !== undefined) {
      pending = decode(m[1]).slice(0, 60)
      continue
    }
    const url = String(m[2] || '').trim()
    if (!/^https?:\/\//i.test(url)) continue
    const name = decode(m[3]).slice(0, 60) || url
    const folder = stack[stack.length - 1] || '未分类'
    if (!map.has(folder)) map.set(folder, [])
    const list = map.get(folder)!
    if (list.some(l => l.url === url)) continue
    list.push({ name, url })
  }

  return Array.from(map.entries())
    .map(([folder, links]) => ({ folder, links }))
    .filter(f => f.links.length > 0)
}
