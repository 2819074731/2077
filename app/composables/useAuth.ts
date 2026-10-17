interface AuthUser { id: number; email: string; username?: string | null; nickname: string; avatar?: string | null; qq?: string | null; slug: string; is_admin?: number; links?: CloudLink[] }
export interface CloudLink { id?: number; name: string; url: string; icon?: string; sort?: number; public?: boolean }

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)

  async function refresh() {
    try {
      const d: any = await $fetch('/api/me')
      user.value = d.user
    } catch {
      user.value = null
    }
  }

  return {
    user,
    refresh,
    restore: refresh,
    async login(account: string, password: string) {
      const d: any = await $fetch('/api/auth/login', { method: 'POST', body: { account, password } })
      user.value = d.user
      await useNav().pullFromCloud()
    },
    async register(email: string, password: string, nickname: string, username: string | undefined, qq: string) {
      const d: any = await $fetch('/api/auth/register', { method: 'POST', body: { email, password, nickname, username, qq } })
      user.value = d.user
    },
    async logout() {
      try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch {}
      user.value = null
    },
    async updateProfile(input: { nickname: string; username?: string; qq?: string; avatar?: string | null }) {
      const d: any = await $fetch('/api/account/profile', { method: 'PUT', body: input })
      if (user.value) user.value = { ...user.value, ...d.user }
      return d.user as AuthUser
    },
    async changePassword(currentPassword: string, newPassword: string) {
      return await $fetch('/api/account/password', {
        method: 'PUT',
        body: { currentPassword, newPassword }
      })
    },
    async revokeOtherSessions() {
      return await $fetch('/api/account/sessions', { method: 'DELETE' })
    },
    async saveCloudLinks(links: CloudLink[]) {
      const d: any = await $fetch('/api/links', { method: 'PUT', body: { links } })
      if (user.value) user.value.links = d.links
      return d.links as CloudLink[]
    }
  }
}
