import type { PermissionModule } from '@/config/permissions'

/**
 * Maps permission API ids (e.g. users.index) to i18n keys under permissions.{module}.{action}
 */
export function usePermissionI18n() {
  const { t } = useI18n()

  function groupLabel(id: PermissionModule) {
    return t(`permissions.groups.${id}`)
  }

  /** Unknown / custom permission ids are returned as-is */
  function actionLabel(id: string) {
    const dot = id.indexOf('.')
    if (dot === -1) return id
    const mod = id.slice(0, dot)
    const action = id.slice(dot + 1)
    const key = `permissions.${mod}.${action}`
    const translated = t(key)
    return translated === key ? id : translated
  }

  return { groupLabel, actionLabel }
}
