export default defineEventHandler(async (event) => {
  const me = await requireAdmin(event)
  const body = await readBody(event)
  const id = Number(body?.id)
  const action = String(body?.action || '')
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少用户 ID' })

  const db = useDb()
  const [rows]: any = await db.query('SELECT id, is_admin FROM users WHERE id = ? LIMIT 1', [id])
  const u = rows[0]
  if (!u) throw createError({ statusCode: 404, statusMessage: '用户不存在' })

  if (action === 'toggle-admin') {
    if (u.id === me.id) throw createError({ statusCode: 400, statusMessage: '不能修改自己的管理员状态' })
    await db.execute('UPDATE users SET is_admin = ? WHERE id = ?', [u.is_admin ? 0 : 1, id])
    return { ok: true, is_admin: u.is_admin ? 0 : 1 }
  }

  if (action === 'delete') {
    if (u.id === me.id) throw createError({ statusCode: 400, statusMessage: '不能删除自己' })
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute('DELETE FROM user_links WHERE user_id = ?', [id])
      await conn.execute('DELETE FROM sessions WHERE user_id = ?', [id])
      await conn.execute('DELETE FROM users WHERE id = ?', [id])
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: '未知操作' })
})
