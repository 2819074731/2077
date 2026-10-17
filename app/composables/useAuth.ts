interface AuthUser { id: number; email: string; nickname: string; slug: string; is_admin?: number; links?: CloudLink[] }
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
    async login(email: string, password: string) {
      const d: any = await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
      user.value = d.user
      await useNav().pullFromCloud()
    },
    async register(email: string, password: string, nickname: string) {
      const d: any = await $fetch('/api/auth/register', { method: 'POST', body: { email, password, nickname } })
      user.value = d.user
    },
    async logout() {
      try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch {}
      user.value = null
    },
    async saveCloudLinks(links: CloudLink[]) {
      const d: any = await $fetch('/api/links', { method: 'PUT', body: { links } })
      if (user.value) user.value.links = d.links
      return d.links as CloudLink[]
    }
  }
}
