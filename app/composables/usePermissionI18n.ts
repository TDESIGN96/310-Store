import { humanizePermissionGroupId, humanizePermissionId } from '@/utils/humanizePermissionId'

/**
 * Maps permission API ids (e.g. users.index) to i18n keys under permissions.{module}.{action}.
 * Unknown ids (no translation yet, e.g. newly added backend permissions) fall back to an
 * auto-humanized English label instead of the raw id.
 */
export function usePermissionI18n() {
  const { t, te } = useI18n()

  function groupLabel(id: string) {
    const key = `permissions.groups.${id}` as const
    if (te(key)) return t(key)
    return humanizePermissionGroupId(id)
  }

  function actionLabel(id: string) {
    const dot = id.indexOf('.')
    if (dot === -1) return humanizePermissionId(id)
    const mod = id.slice(0, dot)
    const action = id.slice(dot + 1)
    const key = `permissions.${mod}.${action}` as const
    return te(key) ? t(key) : humanizePermissionId(id)
  }

  return { groupLabel, actionLabel }
}
