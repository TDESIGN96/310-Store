import { useCookie } from '#app'

const AUTH_TOKEN_COOKIE = 'auth_token'

export default defineAppConfig({
  echo: {
    tokenStorage: {
      async get(app: any) {
        return app.runWithContext(() => {
          const cookie = useCookie<string | undefined>(AUTH_TOKEN_COOKIE, { readonly: true })
          return cookie.value || undefined
        })
      },
      async set(app: any, token?: string) {
        await app.runWithContext(() => {
          const cookie = useCookie<string | undefined>(AUTH_TOKEN_COOKIE)
          cookie.value = token
        })
      },
    },
  },
})
