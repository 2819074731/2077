import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { H3Event } from 'h3'
import { withDefaultAvatar } from './user'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
const DUMMY_HASH = 'scrypt$286ce39455ce8dbd90eb8b6552b5a94b$9ab653468d7eaf595516912e6d0b625f6c90f7f047e47919b9b019cca8161552670254148cbd88453e24dde6c03a7a2a2f93b47add93adbc9a4baf45193c2a33'

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const h = await scryptAsync(pw, salt, 64, SCRYPT)
  return `scrypt$${salt}$${h.toString('hex')}`
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, salt, h] = String(stored).split('$')
  if (alg !== 'scrypt' || !salt || !h) return false
  const a = await scryptAsync(pw, salt, 64, SCRYPT)
  const b = Buffer.from(h, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** 未知账号也执行一次等价开销的校验，避免通过响应时间枚举账号。 */
export async function dummyVerify(pw: string): Promise<void> {
  await verifyPassword(pw, DUMMY_HASH)
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位`
  if (pw.length > PASSWORD_MAX) return `密码最多 ${PASSWORD_MAX} 位`
  return null
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(event: H3Event, userId: number) {
  const token = newToken()
  const db = useDb()
  await db.execute(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
    [hashToken(token), userId]
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
    await db.execute('DELETE FROM sessions WHERE token = ? OR token = ?', [hashToken(sid), sid])
  }
  deleteCookie(event, 'sid', { path: '/' })
}

export async function getSessionUser(event: H3Event) {
  const sid = getCookie(event, 'sid')
  if (!sid) return null
  const db = useDb()
  const selectUser = `SELECT u.id, u.email, u.username, u.nickname, u.avatar, u.qq, u.slug, u.is_admin
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW() LIMIT 1`
  const hashed = hashToken(sid)
  const [rows]: any = await db.query(selectUser, [hashed])
  if (rows[0]) return withDefaultAvatar(rows[0])

  // 兼容升级前写入的明文 token，命中后立即迁移为哈希。
  const [legacy]: any = await db.query(selectUser, [sid])
  if (!legacy[0]) return null
  await db.execute('UPDATE IGNORE sessions SET token = ? WHERE token = ?', [hashed, sid])
  return withDefaultAvatar(legacy[0])
}

export async function revokeOtherSessions(event: H3Event, userId: number) {
  const sid = getCookie(event, 'sid') || ''
  const db = useDb()
  const [r]: any = await db.execute(
    'DELETE FROM sessions WHERE user_id = ? AND token <> ? AND token <> ?',
    [userId, hashToken(sid), sid]
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
