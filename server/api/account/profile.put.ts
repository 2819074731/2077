import { normalizeQq, withDefaultAvatar } from '../../utils/user'

export default defineEventHandler(async (event) => {
  const me = await getSessionUser(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: '未登录' })

  const body = await readBody(event)
  const nickname = String(body?.nickname ?? '').trim()
  const rawUsername = body?.username === undefined ? undefined : String(body.username || '').trim().toLowerCase()
  const hasAvatar = Object.prototype.hasOwnProperty.call(body || {}, 'avatar')
  const rawAvatar = hasAvatar ? String(body.avatar || '') : undefined
  const hasQq = Object.prototype.hasOwnProperty.call(body || {}, 'qq')
  const rawQq = hasQq ? normalizeQq(body.qq) : undefined
  const qqInput = hasQq ? String(body.qq ?? '').trim() : ''

  if (!nickname) throw createError({ statusCode: 400, statusMessage: '昵称不能为空' })
  if (nickname.length > 60) throw createError({ statusCode: 400, statusMessage: '昵称最多 60 个字符' })
  if (hasQq && qqInput && !rawQq) throw createError({ statusCode: 400, statusMessage: '请填写正确的 QQ 号' })
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

  const db = useDb()
  const qq = hasQq ? (rawQq || null) : (me.qq || null)
  if (hasQq && qq !== (me.qq || null)) {
    const [qqTaken]: any = await db.query('SELECT id FROM users WHERE qq = ? AND id <> ? LIMIT 1', [qq, me.id])
    if (qqTaken.length) throw createError({ statusCode: 409, statusMessage: '该 QQ 号已绑定其他账号' })
  }

  const username = rawUsername === undefined ? me.username || null : rawUsername || null
  if (username && username !== (me.username || null)) {
    const [taken]: any = await db.query('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1', [username, me.id])
    if (taken.length) throw createError({ statusCode: 409, statusMessage: '该用户名已被占用' })
  }

  if (avatar === undefined) {
    await db.execute('UPDATE users SET nickname = ?, username = ?, qq = ? WHERE id = ?', [nickname, username, qq, me.id])
  } else {
    await db.execute(
      'UPDATE users SET nickname = ?, username = ?, qq = ?, avatar = ? WHERE id = ?',
      [nickname, username, qq, avatar, me.id]
    )
  }

  return {
    user: withDefaultAvatar({
      ...me,
      nickname,
      username,
      qq,
      avatar: avatar === undefined ? me.avatar : avatar
    })
  }
})
