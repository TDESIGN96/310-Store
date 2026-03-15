import { defineStore } from 'pinia'

interface User {
  id: number
  name: string
  phone: string
  role: string
}

const COOKIE_NAME = 'auth_token'
const COOKIE_USER = 'auth_user'
const COOKIE_OPTS = {
  maxAge: 60 * 60 * 24 * 7, // 7 days
  sameSite: 'lax' as const,
  path: '/',
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  const login = async (credentials: { phone: string; password: string }) => {
    const config = useRuntimeConfig()

    const response = await $fetch<{
      status: string
      status_code: number
      data: { token: string; user: User }
    }>(
      `${config.public.apiBase}/login`,
      {
        method: 'POST',
        body: credentials,
        headers: { Accept: 'application/json' },
      }
    )

    token.value = response.data.token
    user.value = response.data.user

    useCookie(COOKIE_NAME, COOKIE_OPTS).value = response.data.token
    useCookie<User | null>(COOKIE_USER, COOKIE_OPTS).value = response.data.user
  }

  const logout = async () => {
    try {
      const config = useRuntimeConfig()
      await $fetch(`${config.public.apiBase}/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: 'application/json',
        },
      })
    } catch {}

    token.value = null
    user.value = null
    useCookie(COOKIE_NAME).value = null
    useCookie(COOKIE_USER).value = null
  }

  // Called from plugin on every page load — restores token + user from cookies
  const init = () => {
    const storedToken = useCookie(COOKIE_NAME).value
    if (storedToken) token.value = storedToken

    const storedUser = useCookie<User | null>(COOKIE_USER).value
    if (storedUser) user.value = storedUser
  }

  return { token, user, isLoggedIn, login, logout, init }
})