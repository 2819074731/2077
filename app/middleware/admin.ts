export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  if (!import.meta.client) return
  const { user, restore } = useAuth()
  if (!user.value) await restore()
  if (!user.value || !user.value.is_admin) {
    return navigateTo('/login?redirect=/admin')
  }
})
