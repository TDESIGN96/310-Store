import type { Component } from 'vue'
import {
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
  Ruler,
  Layers,
  Warehouse,
  History,
} from 'lucide-vue-next'
import type { PermissionModule } from '@/config/permissions'

export interface NavItem {
  /** i18n key, e.g. nav.items.dashboard */
  labelKey: string
  icon: Component
  /** List/index route */
  path: string
  /**
   * Legacy: single permission for simple items (e.g. products).
   * If set without `module`, sidebar shows link only when this passes.
   */
  requiredPermission?: string
  /**
   * When set, sidebar uses usePermissions().navVisibility(module):
   * hidden | link | dropdown | dropdown-create-only
   */
  module?: PermissionModule
  /** Create route — required for dropdown state */
  createPath?: string
}

export interface NavGroup {
  /** i18n key, e.g. nav.groups.main */
  groupKey: string
  items: NavItem[]
}

export const navItems: NavGroup[] = [
  {
    groupKey: 'nav.groups.main',
    items: [
      { labelKey: 'nav.items.dashboard', icon: LayoutDashboard, path: '/mainCards' },
      {
        labelKey: 'nav.items.activity_log',
        icon: History,
        path: '/activities',
        module: 'activities',
      },
    ],
  },
  {
    groupKey: 'nav.groups.inventory',
    items: [
      { labelKey: 'nav.items.products', icon: Package, path: '/products', requiredPermission: 'view_products' },
      {
        labelKey: 'nav.items.units',
        icon: Ruler,
        path: '/units',
        module: 'units',
        createPath: '/units/create',
      },
      {
        labelKey: 'nav.items.categories',
        icon: Layers,
        path: '/categories',
        module: 'categories',
        createPath: '/categories/create',
      },
      {
        labelKey: 'nav.items.warehouses',
        icon: Warehouse,
        path: '/warehouses',
        module: 'warehouses',
        createPath: '/warehouses/create',
      },
      {
        labelKey: 'nav.items.roles',
        icon: ShieldCheck,
        path: '/roles',
        module: 'roles',
        createPath: '/roles/create',
      },
      {
        labelKey: 'nav.items.users',
        icon: Users,
        path: '/users',
        module: 'users',
        createPath: '/users/create',
      },
    ],
  },
]

/** All nav items flattened with their group key, for breadcrumb lookup */
export function getNavItemsWithGroup(): { item: NavItem; groupKey: string }[] {
  return navItems.flatMap((section) =>
    section.items.map((item) => ({ item, groupKey: section.groupKey })),
  )
}

/** Find the current nav item and group for a given path (most specific match) */
export function getBreadcrumbForPath(path: string): {
  groupKey: string
  item: NavItem
  groupPath: string
} | null {
  for (const section of navItems) {
    const matches = section.items.filter(
      (item) => path === item.path || path.startsWith(item.path + '/'),
    )
    if (matches.length === 0) continue
    const sorted = matches.sort((a, b) => b.path.length - a.path.length)
    const best = sorted[0]
    const groupPath = section.items[0]?.path
    if (!best || groupPath === undefined) continue
    return { groupKey: section.groupKey, item: best, groupPath }
  }
  return null
}
