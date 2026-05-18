import { defineStore } from 'pinia'
import { normalizeApiLocale } from '@/utils/apiLocale'

/** Thrown when login succeeds but the account is inactive; UI should show localized message. */
export class AccountSuspendedError extends Error {
  constructor() {
    super('ACCOUNT_SUSPENDED')
    this.name = 'AccountSuspendedError'
  }
}

interface User {
  id: number
  name: string
  phone: string
  role: string
  is_distributor?: boolean
  /** When `false`, the user must not access the app (blocked at login). */
  is_active?: boolean
  permissions?: Array<string | { name?: string } | { key?: string }>
}

interface LoginResponse {
  status: string
  status_code: number
  data: {
    token: string
    user: User
    permissions?: Array<string | { name?: string } | { key?: string }>
  }
}

const normalizePermissions = (source: unknown): string[] => {
  if (!Array.isArray(source)) return []

  return source
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const permission = item as { name?: string; key?: string }
        return permission.name || permission.key || ''
      }
      return ''
    })
    .filter(Boolean)
}

const COOKIE_NAME = 'auth_token'
const COOKIE_USER = 'auth_user'
/** Persisted permission strings — survives refresh even if user cookie omits them */
const COOKIE_PERMISSIONS = 'auth_permissions'
const COOKIE_OPTS = {
  maxAge: 60 * 60 * 24 * 7, // 7 days
  sameSite: 'lax' as const,
  path: '/',
}

/** Same source as @nuxtjs/i18n `detectBrowserLanguage.cookieKey` — keeps login/logout aligned with UI language. */
const localeHeaderForApi = () =>
  normalizeApiLocale(useCookie<string | null>('i18n_locale').value)

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)
  const permissions = ref<string[]>([])

  const isLoggedIn = computed(() => !!token.value)
  const hasPermission = (permission: string) => permissions.value.includes(permission)

  const login = async (credentials: { phone: string; password: string }) => {
    const config = useRuntimeConfig()

    const response = await $fetch<LoginResponse>(
      `${config.public.apiBase}/login`,
      {
        method: 'POST',
        body: credentials,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Accept-Language': localeHeaderForApi(),
        },
      }
    )

    if (response.data.user.is_active === false) {
      throw new AccountSuspendedError()
    }

    token.value = response.data.token
    user.value = response.data.user
    permissions.value = normalizePermissions(
      response.data.permissions ?? response.data.user?.permissions,
    )

    useCookie(COOKIE_NAME, COOKIE_OPTS).value = response.data.token
    useCookie<User | null>(COOKIE_USER, COOKIE_OPTS).value = response.data.user
    useCookie(COOKIE_PERMISSIONS, COOKIE_OPTS).value = JSON.stringify(permissions.value)
  }

  const logout = async () => {
    try {
      const config = useRuntimeConfig()
      await $fetch(`${config.public.apiBase}/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: 'application/json',
          'Accept-Language': localeHeaderForApi(),
        },
      })
    } catch {}

    token.value = null
    user.value = null
    permissions.value = []
    useCookie(COOKIE_NAME).value = null
    useCookie(COOKIE_USER).value = null
    useCookie(COOKIE_PERMISSIONS).value = null
  }

  // Called from plugin on every page load — restores token + user from cookies
  const init = () => {
    const storedToken = useCookie(COOKIE_NAME).value
    const storedUser = useCookie<User | null>(COOKIE_USER).value

    if (storedUser?.is_active === false) {
      token.value = null
      user.value = null
      permissions.value = []
      useCookie(COOKIE_NAME).value = null
      useCookie(COOKIE_USER).value = null
      useCookie(COOKIE_PERMISSIONS).value = null
      return
    }

    if (storedToken) token.value = storedToken

    if (storedUser) user.value = storedUser

    const rawPerms = useCookie<string | null>(COOKIE_PERMISSIONS).value
    if (rawPerms) {
      try {
        const parsed = JSON.parse(rawPerms) as unknown
        if (Array.isArray(parsed)) {
          permissions.value = parsed.filter((x): x is string => typeof x === 'string')
        }
      } catch {
        permissions.value = []
      }
    }
    if (!permissions.value.length && storedUser) {
      permissions.value = normalizePermissions(storedUser.permissions)
    }
  }

  return { token, user, permissions, isLoggedIn, hasPermission, login, logout, init }
})