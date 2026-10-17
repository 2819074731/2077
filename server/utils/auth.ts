import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  const h = scryptSync(pw, salt, 64).toString('hex')
  return `scrypt$${salt}$${h}`
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, salt, h] = String(stored).split('$')
  if (alg !== 'scrypt' || !salt || !h) return false
  const a = scryptSync(pw, salt, 64)
  const b = Buffer.from(h, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function newToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(event: H3Event, userId: number) {
  const token = newToken()
  const db = useDb()
  await db.execute(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
    [token, userId]
  )
  setCookie(event, 'sid', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: !import.meta.dev
  })
  return token
}

export async function destroySession(event: H3Event) {
  const sid = getCookie(event, 'sid')
  if (sid) {
    const db = useDb()
    await db.execute('DELETE FROM sessions WHERE token = ?', [sid])
  }
  deleteCookie(event, 'sid', { path: '/' })
}

export async function getSessionUser(event: H3Event) {
  const sid = getCookie(event, 'sid')
  if (!sid) return null
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT u.id, u.email, u.username, u.nickname, u.avatar, u.slug, u.is_admin
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW() LIMIT 1`,
    [sid]
  )
  return rows[0] || null
}

export async function revokeOtherSessions(event: H3Event, userId: number) {
  const sid = getCookie(event, 'sid') || ''
  const db = useDb()
  const [r]: any = await db.execute(
    'DELETE FROM sessions WHERE user_id = ? AND token <> ?',
    [userId, sid]
  )
  return Number(r?.affectedRows || 0)
}

export async function requireAdmin(event: H3Event) {
  const user = await getSessionUser(event)
  if (!user || !user.is_admin) {
    throw createError({ statusCode: 401, statusMessage: '需要管理员权限' })
  }
  return user
}

export function slugify(input: string): string {
  const base = String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'u' + randomBytes(3).toString('hex')
}
