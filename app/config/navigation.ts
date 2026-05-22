import type { Component } from 'vue'
import {
  LayoutDashboard,
  Package,
  FileText,
  ShieldCheck,
  Users,
  Ruler,
  MapPin,
  Layers,
  SlidersHorizontal,
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
  /** Optional secondary create route (e.g. create combo) */
  secondaryCreatePath?: string
  /** Optional label key for secondary create route */
  secondaryCreateLabelKey?: string
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
    ],
  },
  {
    groupKey: 'nav.groups.inventory',
    items: [
      {
        labelKey: 'nav.items.products',
        icon: Package,
        path: '/products',
        module: 'products',
        createPath: '/products/create',
        secondaryCreatePath: '/products/create-combo',
        secondaryCreateLabelKey: 'nav.submenu.create_combo',
      },
      {
        labelKey: 'nav.items.units',
        icon: Ruler,
        path: '/units',
        module: 'units',
        createPath: '/units/create',
      },
    
      {
        labelKey: 'nav.items.districts',
        icon: MapPin,
        path: '/districts',
        module: 'districts',
        createPath: '/districts/create',
      },
      {
        labelKey: 'nav.items.categories',
        icon: Layers,
        path: '/categories',
        module: 'categories',
        createPath: '/categories/create',
      },
      {
        labelKey: 'nav.items.attributes',
        icon: SlidersHorizontal,
        path: '/attributes',
        module: 'attributes',
        createPath: '/attributes/create',
      },
      {
        labelKey: 'nav.items.warehouses',
        icon: Warehouse,
        path: '/warehouses',
        module: 'warehouses',
        createPath: '/warehouses/create',
      },
    ],
  },
  {
    groupKey: 'nav.groups.sales',
    items: [
      {
        labelKey: 'nav.items.quotations',
        icon: FileText,
        path: '/quotations',
        module: 'quotations',
        createPath: '/quotations/create',
      },
      {
        labelKey: 'nav.items.invoices',
        icon: FileText,
        path: '/invoices',
        module: 'invoices',
        createPath: '/invoices/create',
      },
      {
        labelKey: 'nav.items.invoice_returns',
        icon: FileText,
        path: '/invoice-returns',
        module: 'invoice_returns',
      },
    ],
  },
  {
    groupKey: 'nav.groups.administration',
    items: [
      // {
      //   labelKey: 'nav.items.distributors',
      //   icon: Users,
      //   path: '/distributors',
      //   module: 'distributors',
      //   createPath: '/distributors/create',
      // },
      {
        labelKey: 'nav.items.users',
        icon: Users,
        path: '/users',
        module: 'users',
        createPath: '/users/create',
      },
      {
        labelKey: 'nav.items.roles',
        icon: ShieldCheck,
        path: '/roles',
        module: 'roles',
        createPath: '/roles/create',
      },
      {
        labelKey: 'nav.items.activity_log',
        icon: History,
        path: '/activities',
        module: 'activities',
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
  // Profile is reachable from header menu, not sidebar nav items.
  // Keep breadcrumb localized instead of falling back to raw route path.
  if (path === '/profile' || path.startsWith('/profile/')) {
    return {
      groupKey: 'nav.groups.main',
      groupPath: '/mainCards',
      item: {
        labelKey: 'header.profile',
        icon: LayoutDashboard,
        path: '/profile',
      },
    }
  }

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
