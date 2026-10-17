export default defineEventHandler(async (event) => {
  const me = await getSessionUser(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: '未登录' })

  const body = await readBody(event)
  const nickname = String(body?.nickname ?? '').trim()
  const rawUsername = body?.username === undefined ? undefined : String(body.username || '').trim().toLowerCase()
  const hasAvatar = Object.prototype.hasOwnProperty.call(body || {}, 'avatar')
  const rawAvatar = hasAvatar ? String(body.avatar || '') : undefined

  if (!nickname) throw createError({ statusCode: 400, statusMessage: '昵称不能为空' })
  if (nickname.length > 60) throw createError({ statusCode: 400, statusMessage: '昵称最多 60 个字符' })
  if (rawUsername !== undefined && rawUsername && !/^[a-z0-9_-]{3,60}$/.test(rawUsername)) {
    throw createError({ statusCode: 400, statusMessage: '用户名需 3-60 位字母、数字、下划线或短横线' })
  }

  let avatar: string | null | undefined = undefined
  if (rawAvatar !== undefined) {
    if (!rawAvatar) {
      avatar = null
    } else {
      if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(rawAvatar)) {
        throw createError({ statusCode: 400, statusMessage: '头像格式不正确' })
      }
      if (rawAvatar.length > 400000) throw createError({ statusCode: 400, statusMessage: '头像文件过大' })
      avatar = rawAvatar
    }
  }

  const username = rawUsername === undefined ? me.username || null : rawUsername || null
  const db = useDb()
  if (username && username !== (me.username || null)) {
    const [taken]: any = await db.query('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1', [username, me.id])
    if (taken.length) throw createError({ statusCode: 409, statusMessage: '该用户名已被占用' })
  }

  if (avatar === undefined) {
    await db.execute('UPDATE users SET nickname = ?, username = ? WHERE id = ?', [nickname, username, me.id])
  } else {
    await db.execute(
      'UPDATE users SET nickname = ?, username = ?, avatar = ? WHERE id = ?',
      [nickname, username, avatar, me.id]
    )
  }

  return {
    user: {
      ...me,
      nickname,
      username,
      avatar: avatar === undefined ? me.avatar : avatar
    }
  }
})
