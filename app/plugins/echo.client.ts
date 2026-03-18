import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { useAuthStore } from '@/stores/auth'

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

  const getAuthorizationHeader = (): Record<string, string> => {
    if (!authStore.token) return {}
    return { Authorization: `Bearer ${authStore.token}` }
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
      headers: getAuthorizationHeader(),
    },
  })

  // Keep auth headers fresh for future private/presence auth handshakes.
  watch(
    () => authStore.token,
    () => {
      const connector = (echo as any).connector
      if (!connector?.options) return

      connector.options.auth = {
        ...(connector.options.auth || {}),
        headers: getAuthorizationHeader(),
      }
    },
    { immediate: true },
  )

  nuxtApp.provide('echo', echo)
})
