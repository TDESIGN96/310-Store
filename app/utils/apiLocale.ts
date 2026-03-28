/** API locale values aligned with `nuxt.config` i18n `locales[].code` (`ar` | `en`). */
export type ApiLocale = 'ar' | 'en'

export function normalizeApiLocale(code: string | null | undefined): ApiLocale {
  if (code === 'en' || code === 'ar') return code
  return 'ar'
}
