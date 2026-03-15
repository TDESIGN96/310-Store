export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/') return

  let token: string | null | undefined = null

  if (import.meta.server) {
    // On the server, parse the raw Cookie header — most reliable approach
    const headers = useRequestHeaders(['cookie'])
    const raw = headers.cookie ?? ''
    const match = raw.split(';').map(c => c.trim()).find(c => c.startsWith('auth_token='))
    token = match ? match.split('=').slice(1).join('=') : null
  } else {
    // On the client, useCookie reads document.cookie
    token = useCookie('auth_token').value
  }

  if (!token) {
    return navigateTo('/')
  }
})
