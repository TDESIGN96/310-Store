import type { Component } from 'vue'
import {
  LayoutDashboard,
  ReceiptText,
  FileText,
  UserCircle,
  Package,
  Warehouse,
  ArrowLeftRight,
  AlertTriangle,
} from 'lucide-vue-next'

export interface NavItem {
  label: string
  icon: Component
  path: string
}

export interface NavGroup {
  group: string
  items: NavItem[]
}

export const navItems: NavGroup[] = [
  {
    group: 'الرئيسية',
    items: [{ label: 'لوحة التحكم', icon: LayoutDashboard, path: '/dashboard' }],
  },
  {
    group: 'المبيعات',
    items: [
      { label: 'الفواتير', icon: ReceiptText, path: '/sales/invoices' },
      { label: 'عروض الأسعار', icon: FileText, path: '/sales/quotes' },
      { label: 'العملاء', icon: UserCircle, path: '/sales/customers' },
    ],
  },
  {
    group: 'المخزون',
    items: [
      { label: 'المنتجات', icon: Package, path: '/products' },
      { label: 'المستودعات', icon: Warehouse, path: '/inventory/warehouses' },
      { label: 'التحويلات', icon: ArrowLeftRight, path: '/inventory/transfers' },
      { label: 'التالف', icon: AlertTriangle, path: '/inventory/damaged' },
    ],
  },
]

/** All nav items flattened with their group, for breadcrumb lookup */
export function getNavItemsWithGroup(): { item: NavItem; group: string }[] {
  return navItems.flatMap((section) =>
    section.items.map((item) => ({ item, group: section.group }))
  )
}

/** Find the current nav item and group for a given path (most specific match) */
export function getBreadcrumbForPath(path: string): {
  group: string
  item: NavItem
  groupPath: string
} | null {
  for (const section of navItems) {
    const matches = section.items.filter(
      (item) => path === item.path || path.startsWith(item.path + '/')
    )
    if (matches.length === 0) continue
    const sorted = matches.sort((a, b) => b.path.length - a.path.length)
    const best = sorted[0]
    const groupPath = section.items[0]?.path
    if (!best || groupPath === undefined) continue
    return { group: section.group, item: best, groupPath }
  }
  return null
}
