import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'

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
       toast.error('بيانات غير صحيحة')
        navigateTo('/')
      }

      // 422 → validation error → handled per form
      // 500 → server error → log to console for now
      if (response.status === 500) {
        toast.error('خطأ في الخادم', {
          description: 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً'
        })
        console.error('Server error', response._data ?? response.statusText)
      }
    },
  })

  return { $api }
}