import { useAuthStore } from '@/stores/auth'
import { normalizeApiLocale } from '@/utils/apiLocale'

export const useApi = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  // Must run at setup time — not inside onResponseError (useI18n rules)
  const { getErrorMessage } = useApiError()
  const { locale } = useI18n()

  const $api = $fetch.create({
    baseURL: config.public.apiBase,

    onRequest({ options }) {
      const headers = new Headers(options.headers as HeadersInit | undefined)
      headers.set('Accept', 'application/json')
      headers.set('Accept-Language', normalizeApiLocale(locale.value))

      if (authStore.token) {
        headers.set('Authorization', `Bearer ${authStore.token}`)
        headers.set('Content-Type', 'application/json')
      }

      options.headers = headers
    },

    onResponseError({ response }) {
      if (response.status === 401) {
        authStore.logout()
        navigateTo('/')
        return
      }

      // 404/422 → handled by page-level inline UI (loadError/field errors)
      if (response.status === 404 || response.status === 422) return

      // Backend `message` (e.g. Arabic) — getErrorMessage reads `response._data`
      import('vue-sonner').then(({ toast }) => {
        toast.error(getErrorMessage({ response }))
      })
    },
  })

  return { $api }
}
