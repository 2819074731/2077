import { requireAdmin } from '../../../utils/auth'
import { getGithubTokenAdminStatus, readStoredGithubTokens, saveGithubTokens } from '../../../utils/githubTokens'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const index = Number(body?.index)
  const stored = await readStoredGithubTokens()
  if (!Number.isInteger(index) || index < 0 || index >= stored.length) {
    throw createError({ statusCode: 400, statusMessage: 'Token 不存在，请刷新后重试' })
  }
  stored.splice(index, 1)
  await saveGithubTokens(stored)
  return { ok: true, ...(await getGithubTokenAdminStatus()) }
})
