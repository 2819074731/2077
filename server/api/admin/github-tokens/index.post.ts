import { requireAdmin } from '../../../utils/auth'
import {
  MAX_STORED_GITHUB_TOKENS,
  fetchGithubQuota,
  getEnvGithubTokens,
  getGithubTokenAdminStatus,
  normalizeGithubToken,
  readStoredGithubTokens,
  saveGithubTokens
} from '../../../utils/githubTokens'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const token = normalizeGithubToken(body?.token)
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token 格式不正确，请粘贴完整的 GitHub Token' })
  }

  const stored = await readStoredGithubTokens()
  if (stored.length >= MAX_STORED_GITHUB_TOKENS) {
    throw createError({ statusCode: 400, statusMessage: `最多保存 ${MAX_STORED_GITHUB_TOKENS} 个 Token` })
  }
  if (stored.includes(token) || getEnvGithubTokens().includes(token)) {
    throw createError({ statusCode: 400, statusMessage: '该 Token 已存在' })
  }

  const quota = await fetchGithubQuota(token)
  if (!quota.valid) {
    throw createError({ statusCode: 400, statusMessage: 'Token 无效或已过期，请重新生成' })
  }

  await saveGithubTokens([...stored, token])
  return { ok: true, ...(await getGithubTokenAdminStatus()) }
})
