import type { Component } from 'vue'
import {
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
  Ruler,
  Layers,
} from 'lucide-vue-next'

export interface NavItem {
  /** i18n key, e.g. nav.items.dashboard */
  labelKey: string
  icon: Component
  path: string
  requiredPermission?: string
}

export interface NavGroup {
  /** i18n key, e.g. nav.groups.main */
  groupKey: string
  items: NavItem[]
}

export const navItems: NavGroup[] = [
  {
    groupKey: 'nav.groups.main',
    items: [{ labelKey: 'nav.items.dashboard', icon: LayoutDashboard, path: '/mainCards' }],
  },
  {
    groupKey: 'nav.groups.inventory',
    items: [
      { labelKey: 'nav.items.products', icon: Package, path: '/products', requiredPermission: 'view_products' },
      { labelKey: 'nav.items.units', icon: Ruler, path: '/units', requiredPermission: 'units.index' },
      { labelKey: 'nav.items.categories', icon: Layers, path: '/categories', requiredPermission: 'categories.index' },
      { labelKey: 'nav.items.roles', icon: ShieldCheck, path: '/roles' },
      { labelKey: 'nav.items.users', icon: Users, path: '/users' },
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
