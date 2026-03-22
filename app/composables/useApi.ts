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
      const { getErrorMessage } = useApiError()

      if (response.status === 401) {
        authStore.logout()
        navigateTo('/')
        return
      }

      // 422 → field validation — handled per form with getFieldErrors()
      if (response.status === 422) return

      import('vue-sonner').then(({ toast }) => {
        toast.error(getErrorMessage({ response }))
      })
    },
  })

  return { $api }
}
