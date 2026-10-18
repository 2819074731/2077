import { requireAdmin } from '../../../utils/auth'
import { getGithubTokenAdminStatus } from '../../../utils/githubTokens'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await getGithubTokenAdminStatus()
})
