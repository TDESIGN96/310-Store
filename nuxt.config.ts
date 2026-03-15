// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import { useAuthStore } from './app/stores/auth'
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: 'https://310-commerce-backend-main-ocxb8j.laravel.cloud/api'
    }
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
  modules: ['@pinia/nuxt', 'shadcn-nuxt', 'nuxt-laravel-echo'],
  echo: {
    key: 'dA6V4f6Gn3QYA7NDgd6t',
    broadcaster: 'reverb',
    host: 'ws-a14d3d63-48f2-43f1-a933-d3e4cfde010c-reverb.laravel.cloud',
    port: 443,
    scheme: 'https', // In Nuxt config, use 'scheme' not forceTLS; will use 'https' for secure websocket by default.
    transports: ['ws', 'wss'],
    authentication: {
      mode: 'token',
      baseUrl: 'https://310-commerce-backend-main-ocxb8j.laravel.cloud',
      authEndpoint: '/api/broadcasting/auth',
      // Cannot set headers dynamically here; set in plugin/middleware when injecting Echo instance
    },
    logLevel: 3,
    properties: {
      // For nuxt-laravel-echo, use `properties` to append extra Echo options
      // Set wsHost/wsPort, enabledTransports, and forceTLS (as per provided JS)
      wsHost: 'ws-a14d3d63-48f2-43f1-a933-d3e4cfde010c-reverb.laravel.cloud',
      wsPort: 443,
      forceTLS: false, // Use false if you want ws:// over wss://, otherwise remove or set scheme to https
      enabledTransports: ['ws', 'wss'],
      auth: {
        headers: {
          // This cannot interpolate Nuxt/Pinia tokens at config-time.
          // To set a dynamic token, configure this at runtime via plugin.
          // Here, show placeholder for clarity:
          Authorization: `Bearer 38|zkE3BDLLMvpbzmRlL2ALbWdpZXpUOitLfu9Wpidvdbf94a56`,
        },
      },
    },
  },
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
      include: ['nuxt-laravel-echo > pusher-js'],
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
})  