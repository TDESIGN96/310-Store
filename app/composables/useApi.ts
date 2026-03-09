import { useAuthStore } from '@/stores/auth'

export const useApi = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  const $api = $fetch.create({
    baseURL: config.public.apiBase,

    onRequest({ options }) {
      // Auto-attach token on every request
      if (authStore.token) {
        const headers = new Headers(options.headers as HeadersInit | undefined)
        headers.set('Authorization', `Bearer ${authStore.token}`)
        headers.set('Accept', 'application/json')
        headers.set('Content-Type', 'application/json')
        options.headers = headers
      }
    },

    onResponseError({ response }) {
      // 401 → token expired → logout
      if (response.status === 401) {
        authStore.logout()
        navigateTo('/')
      }

      // 422 → validation error → handled per form
      // 500 → server error → log to console for now
      if (response.status === 500) {
        // You can replace this with a proper toast/notification later
        console.error('Server error', response._data ?? response.statusText)
      }
    },
  })

  return { $api }
}