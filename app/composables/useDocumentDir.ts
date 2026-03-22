/**
 * Document reading direction from the active i18n locale (`dir` in `nuxt.config` i18n.locales).
 * Use for `dir` on page roots; Reka dropdowns/popovers also use `ConfigProvider` in `app.vue`.
 */
export function useDocumentDir() {
  const { localeProperties } = useI18n()

  const isRtl = computed(() => localeProperties.value.dir === 'rtl')
  const dir = computed<'ltr' | 'rtl'>(() => (isRtl.value ? 'rtl' : 'ltr'))

  return { isRtl, dir }
}
