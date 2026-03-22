import { useAuthStore } from '@/stores/auth'

export const useApi = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  // Must run at setup time — not inside onResponseError (useI18n rules)
  const { getErrorMessage } = useApiError()

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
      if (response.status === 401) {
        authStore.logout()
        navigateTo('/')
        return
      }

      // 422 → handled per form with getFieldErrors() + field UI
      if (response.status === 422) return

      // Backend `message` (e.g. Arabic) — getErrorMessage reads `response._data`
      import('vue-sonner').then(({ toast }) => {
        toast.error(getErrorMessage({ response }))
      })
    },
  })

  return { $api }
}
