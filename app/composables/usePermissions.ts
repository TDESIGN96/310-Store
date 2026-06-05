import type { PermissionModule } from '@/config/permissions'

/**
 * Central permission helpers — always use this instead of ad-hoc auth checks.
 * Aligns with backend: `{module}.{action}` e.g. `units.index`, `units.store`.
 */
export function usePermissions() {
  const authStore = useAuthStore()
  const restrictedModulesForDistributor = new Set<PermissionModule>([
    'units',
    'districts',
    'categories',
    'attributes',
    'warehouses',
    'roles',
    'distributors',
  ])

  const isDistributorUser = computed(() => Boolean(authStore.user?.is_distributor))
  const isModuleBlockedForDistributor = (module: PermissionModule) =>
    isDistributorUser.value && restrictedModulesForDistributor.has(module)

  const can = (permission: string) => {
    const [module] = permission.split('.')
    if (
      isDistributorUser.value
      && module
      && restrictedModulesForDistributor.has(module as PermissionModule)
    ) {
      return false
    }
    return authStore.hasPermission(permission)
  }

  /** Can see list or module area (index or show permission from API) */
  const canAccess = (module: PermissionModule) => {
    if (isModuleBlockedForDistributor(module)) return false
    if (module === 'stocktaking') return can('stocktaking.view')
    return can(`${module}.index`) || can(`${module}.show`)
  }

  const canCreate = (module: PermissionModule) => {
    if (isModuleBlockedForDistributor(module)) return false
    if (module === 'stocktaking') return can('stocktaking.create')
    return can(`${module}.store`)
  }

  const canEdit = (module: PermissionModule) =>
    !isModuleBlockedForDistributor(module) && can(`${module}.update`)

  const canDelete = (module: PermissionModule) =>
    !isModuleBlockedForDistributor(module) && can(`${module}.destroy`)

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
    if (isModuleBlockedForDistributor(module)) return 'hidden'
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
