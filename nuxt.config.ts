// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env ?? {}

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
    key: env.NUXT_PUBLIC_ECHO_KEY || '',
    broadcaster: (env.NUXT_PUBLIC_ECHO_BROADCASTER as 'reverb' | 'pusher') || 'reverb',
    host: env.NUXT_PUBLIC_ECHO_HOST || 'localhost',
    port: Number(env.NUXT_PUBLIC_ECHO_PORT || 8080),
    scheme: (env.NUXT_PUBLIC_ECHO_SCHEME as 'http' | 'https') || 'https',
    transports: ['ws', 'wss'],
    authentication: {
      mode: 'token',
      baseUrl: env.NUXT_PUBLIC_ECHO_AUTH_BASE_URL || 'https://310-commerce-backend-main-ocxb8j.laravel.cloud',
      authEndpoint: env.NUXT_PUBLIC_ECHO_AUTH_ENDPOINT || '/api/broadcasting/auth',
      csrfEndpoint: env.NUXT_PUBLIC_ECHO_CSRF_ENDPOINT || '/sanctum/csrf-cookie',
      csrfCookie: env.NUXT_PUBLIC_ECHO_CSRF_COOKIE || 'XSRF-TOKEN',
      csrfHeader: env.NUXT_PUBLIC_ECHO_CSRF_HEADER || 'X-XSRF-TOKEN',
    },
    logLevel: Number(env.NUXT_PUBLIC_ECHO_LOG_LEVEL || 3),
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