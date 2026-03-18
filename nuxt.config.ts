// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: 'https://310-commerce-backend-main-ocxb8j.laravel.cloud/api',
      echo: {
        key: 'dA6V4f6Gn3QYA7NDgd6t',
        wsHost: 'ws-a14d3d63-48f2-43f1-a933-d3e4cfde010c-reverb.laravel.cloud',
        wsPort: 443,
        wssPort: 443,
        forceTLS: true,
        authBaseUrl: 'https://310-commerce-backend-main-ocxb8j.laravel.cloud',
        authEndpoint: '/api/broadcasting/auth',
      },
    },
  },
  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap',
        },
      ],
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
    optimizeDeps: {
      include: ['pusher-js'],
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
})  