import type { H3Event } from 'h3'

interface LogUser {
  id?: number
  username?: string
  nickname?: string
}

/** 记录后台高风险操作；日志失败不影响主流程。 */
export async function logAdmin(
  event: H3Event,
  user: LogUser | null,
  action: string,
  target: string,
  detail: unknown
): Promise<void> {
  try {
    const db = useDb()
    const username = String(user?.username || user?.nickname || '').slice(0, 60)
    let payload = ''
    try {
      payload = JSON.stringify(detail ?? {})
    } catch {
      payload = '{}'
    }
    const ip = String(getRequestIP(event, { xForwardedFor: true }) || '').slice(0, 64)
    await db.execute(
      `INSERT INTO admin_logs (user_id, username, action, target, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Number(user?.id || 0), username, action.slice(0, 40), target.slice(0, 191), payload.slice(0, 60000), ip]
    )
  } catch (err: any) {
    console.warn('[admin-log] 写入失败', String(err?.message || err))
  }
}
