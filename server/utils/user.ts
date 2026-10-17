const QQ_RE = /^[1-9]\d{4,11}$/

export function normalizeQq(input: unknown): string {
  const v = String(input ?? '').trim()
  return QQ_RE.test(v) ? v : ''
}

export function qqAvatarUrl(qq: string | null | undefined, size = 100): string {
  const v = normalizeQq(qq)
  if (!v) return ''
  return `https://q1.qlogo.cn/g?b=qq&nk=${v}&s=${size}`
}

export function withDefaultAvatar<T extends { avatar?: string | null; qq?: string | null }>(user: T): T {
  if (user.avatar) return user
  const avatar = qqAvatarUrl(user.qq)
  return avatar ? { ...user, avatar } : user
}
