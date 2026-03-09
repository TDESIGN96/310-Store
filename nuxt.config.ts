// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
 
  runtimeConfig: {
    public: {
      apiBase: 'https://310-commerce-backend-main-ocxb8j.laravel.cloud/api'
    }
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'ar',
        dir: 'rtl',
      }
    }
  },
  
  
  future: {
    compatibilityVersion: 4, // ← enables Nuxt 4 app/ structure
  },
  modules: ['@pinia/nuxt', 'shadcn-nuxt'],
  
  shadcn: {
    /**
     * Prefix for all the imported component.
     * @default "Ui"
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * Will respect the Nuxt aliases.
     * @link https://nuxt.com/docs/api/nuxt-config#alias
     * @default "@/components/ui"
     */
    componentDir: '@/components/ui'
  },
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss() as any],
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
})
