export function cleanText(value: unknown, max: number, multiline = false): string {
  let s = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  if (!multiline) s = s.replace(/[\n\t]+/g, ' ')
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return s.slice(0, max)
}

export function cleanDate(value: unknown): string {
  const s = String(value ?? '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return ''
  return s
}

export function safeIcon(value: unknown): string {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (s.startsWith('/api/icon?')) return s.slice(0, 500)
  try {
    const u = new URL(s)
    if ((u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password) {
      return u.toString().slice(0, 500)
    }
  } catch {}
  return ''
}
