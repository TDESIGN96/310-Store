import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { useAuthStore } from '@/stores/auth'
import { normalizeApiLocale } from '@/utils/apiLocale'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

type EchoRuntimeConfig = {
  key: string
  wsHost: string
  wsPort: number
  wssPort: number
  forceTLS: boolean
  authBaseUrl: string
  authEndpoint: string
}

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  const echoConfig = config.public.echo as EchoRuntimeConfig

  window.Pusher = Pusher

  const i18nLocaleCookie = useCookie<string | null>('i18n_locale')

  const broadcastingAuthHeaders = (): Record<string, string> => {
    const lang = normalizeApiLocale(i18nLocaleCookie.value)
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': lang,
    }
    if (authStore.token)
      headers.Authorization = `Bearer ${authStore.token}`
    return headers
  }

  const echo = new Echo({
    broadcaster: 'reverb',
    key: echoConfig.key,
    wsHost: echoConfig.wsHost,
    wsPort: echoConfig.wsPort,
    wssPort: echoConfig.wssPort,
    forceTLS: echoConfig.forceTLS,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${echoConfig.authBaseUrl}${echoConfig.authEndpoint}`,
    auth: {
      headers: broadcastingAuthHeaders(),
    },
  })

  // Keep auth + locale headers fresh for private/presence auth handshakes.
  watch(
    () => [authStore.token, i18nLocaleCookie.value] as const,
    () => {
      const connector = (echo as any).connector
      if (!connector?.options) return

      connector.options.auth = {
        ...(connector.options.auth || {}),
        headers: broadcastingAuthHeaders(),
      }
    },
    { immediate: true },
  )

  nuxtApp.provide('echo', echo)
})
