// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'pathe'
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: import.meta.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api',
      echo: {
        key: 'dA6V4f6Gn3QYA7NDgd6t',
        wsHost: 'ws-a14d3d63-48f2-43f1-a933-d3e4cfde010c-reverb.laravel.cloud',
        wsPort: 443,
        wssPort: 443,
        forceTLS: true,
        authBaseUrl: import.meta.env.NUXT_PUBLIC_ECHO_AUTH_BASE_URL,
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
      // lang/dir are set dynamically in app.vue from i18n locale (avoid SSR/client mismatch).
    }
  },
  
  
  future: {
    compatibilityVersion: 4, // ← enables Nuxt 4 app/ structure
  },
  modules: ['@pinia/nuxt', 'shadcn-nuxt', '@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'ar', language: 'ar-SA', file: 'ar.ts', name: 'العربية', dir: 'rtl' },
      { code: 'en', language: 'en-US', file: 'en.ts', name: 'English', dir: 'ltr' },
    ],
    defaultLocale: 'ar',
    strategy: 'no_prefix',
    langDir: 'locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'no prefix',
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
      include: ['pusher-js'],
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  hooks: {
    'pages:extend'(pages) {
      const ensurePageRoute = (path: string, file: string, name: string) => {
        if (pages.some(page => page.path === path)) return
        pages.push({
          name,
          path,
          file: resolve(file),
        } as any)
      }

      ensurePageRoute('/invoices', 'app/pages/invoices/index.vue', 'invoices-index-manual')
      ensurePageRoute('/invoices/create', 'app/pages/invoices/create.vue', 'invoices-create-manual')
      ensurePageRoute('/invoices/show/:id', 'app/pages/invoices/show/[id].vue', 'invoices-show-id-manual')
      ensurePageRoute('/invoices/edit/:id', 'app/pages/invoices/edit/[id].vue', 'invoices-edit-id-manual')
      ensurePageRoute('/invoices/return/:id', 'app/pages/invoices/return/[id].vue', 'invoices-return-id-manual')
      ensurePageRoute('/invoice-returns', 'app/pages/invoice-returns/index.vue', 'invoice-returns-index-manual')
      ensurePageRoute('/invoice-returns/show/:id', 'app/pages/invoice-returns/show/[id].vue', 'invoice-returns-show-id-manual')
      ensurePageRoute('/invoice-returns/edit/:id', 'app/pages/invoice-returns/edit/[id].vue', 'invoice-returns-edit-id-manual')
    },
  },
})  