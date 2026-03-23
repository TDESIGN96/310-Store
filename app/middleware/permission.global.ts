import { getRequiredPermissionsForPath } from '@/config/routePermissions'

/**
 * Layer 2 — after auth, block direct URL access when the user lacks the route permission.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/') return

  let token: string | null | undefined = null

  if (import.meta.server) {
    const headers = useRequestHeaders(['cookie'])
    const raw = headers.cookie ?? ''
    const match = raw.split(';').map(c => c.trim()).find(c => c.startsWith('auth_token='))
    token = match ? match.split('=').slice(1).join('=') : null
  } else {
    const authStore = useAuthStore()
    token = authStore.token || useCookie('auth_token').value
  }

  if (!token) return

  const required = getRequiredPermissionsForPath(to.path)
  if (required === null || required.length === 0) return

  const authStore = useAuthStore()
  const allowed = required.some(p => authStore.hasPermission(p))
  if (!allowed) {
    return navigateTo('/mainCards')
  }
})
