export const useApi = () => {
    const config = useRuntimeConfig()
    const authStore = useAuthStore()
  
    const $api = $fetch.create({
      baseURL: config.public.apiBase,
  
      onRequest({ options }) {
        // Auto-attach token on every request
        if (authStore.token) {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${authStore.token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }
        }
      },
  
      onResponseError({ response }) {
        // 401 → token expired → logout
        if (response.status === 401) {
          authStore.logout()
          navigateTo('/')
        }
  
        // 422 → validation error → handled per form
        // 500 → server error → show toast
        if (response.status === 500) {
          useToast().toast({
            title: 'خطأ في الخادم',
            description: 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً',
            variant: 'destructive',
          })
        }
      },
    })
  
    return { $api }
  }