import type { PermissionModule } from '@/config/permissions'

/**
 * Central permission helpers — always use this instead of ad-hoc auth checks.
 * Aligns with backend: `{module}.{action}` e.g. `units.index`, `units.store`.
 */
export function usePermissions() {
  const authStore = useAuthStore()

  const can = (permission: string) => authStore.hasPermission(permission)

  /** Can see list or module area (index or show permission from API) */
  const canAccess = (module: PermissionModule) =>
    can(`${module}.index`) || can(`${module}.show`)

  const canCreate = (module: PermissionModule) => can(`${module}.store`)

  const canEdit = (module: PermissionModule) => can(`${module}.update`)

  const canDelete = (module: PermissionModule) => can(`${module}.destroy`)

  /**
   * Sidebar:
   * - hidden = no list access and no create
   * - link = can list (index/show) only
   * - dropdown = list + create
   * - dropdown-create-only = can create but cannot list (only Create in submenu)
   */
  const navVisibility = (
    module: PermissionModule,
  ): 'hidden' | 'link' | 'dropdown' | 'dropdown-create-only' => {
    const list = canAccess(module)
    const create = canCreate(module)
    if (!list && !create) return 'hidden'
    if (list && !create) return 'link'
    if (list && create) return 'dropdown'
    return 'dropdown-create-only'
  }

  return {
    can,
    canAccess,
    canCreate,
    canEdit,
    canDelete,
    navVisibility,
  }
}
