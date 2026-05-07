export type PermissionAction = 'index' | 'show' | 'store' | 'update' | 'destroy' | 'activate' | 'deactivate'
export type PermissionModule =
  | 'users'
  | 'roles'
  | 'products'
  | 'quotations'
  | 'invoices'
  | 'product_variations'
  | 'units'
  | 'categories'
  | 'attributes'
  | 'reports'
  | 'warehouses'
  | 'activities'
export type PermissionKey = `${PermissionModule}.${PermissionAction}`

export interface PermissionItem {
  id: PermissionKey
}

export interface PermissionGroup {
  id: PermissionModule
  permissions: PermissionItem[]
}

export const permissionGroups: PermissionGroup[] = [
  {
    id: 'users',
    permissions: [
      { id: 'users.index' },
      { id: 'users.show' },
      { id: 'users.store' },
      { id: 'users.update' },
      { id: 'users.destroy' },
    ],
  },
  {
    id: 'roles',
    permissions: [
      { id: 'roles.index' },
      { id: 'roles.show' },
      { id: 'roles.store' },
      { id: 'roles.update' },
      { id: 'roles.destroy' },
    ],
  },
  {
    id: 'products',
    permissions: [
      { id: 'products.index' },
      { id: 'products.show' },
      { id: 'products.store' },
      { id: 'products.update' },
      { id: 'products.destroy' },
    ],
  },
  {
    id: 'quotations',
    permissions: [
      { id: 'quotations.index' },
      { id: 'quotations.show' },
      { id: 'quotations.store' },
      { id: 'quotations.update' },
      { id: 'quotations.destroy' },
    ],
  },
  {
    id: 'invoices',
    permissions: [
      { id: 'invoices.index' },
      { id: 'invoices.show' },
      { id: 'invoices.store' },
      { id: 'invoices.update' },
      { id: 'invoices.destroy' },
    ],
  },
  {
    id: 'product_variations',
    permissions: [
      { id: 'product_variations.index' },
      { id: 'product_variations.show' },
      { id: 'product_variations.store' },
      { id: 'product_variations.update' },
      { id: 'product_variations.destroy' },
      { id: 'product_variations.activate' },
      { id: 'product_variations.deactivate' },
    ],
  },
  {
    id: 'units',
    permissions: [
      { id: 'units.index' },
      { id: 'units.show' },
      { id: 'units.store' },
      { id: 'units.update' },
      { id: 'units.destroy' },
    ],
  },
  {
    id: 'categories',
    permissions: [
      { id: 'categories.index' },
      { id: 'categories.show' },
      { id: 'categories.store' },
      { id: 'categories.update' },
      { id: 'categories.destroy' },
    ],
  },
  {
    id: 'attributes',
    permissions: [
      { id: 'attributes.index' },
      { id: 'attributes.show' },
      { id: 'attributes.store' },
      { id: 'attributes.update' },
      { id: 'attributes.destroy' },
    ],
  },
  {
    id: 'reports',
    permissions: [
      { id: 'reports.index' },
      { id: 'reports.show' },
      { id: 'reports.store' },
      { id: 'reports.update' },
      { id: 'reports.destroy' },
    ],
  },
  {
    id: 'warehouses',
    permissions: [
      { id: 'warehouses.index' },
      { id: 'warehouses.show' },
      { id: 'warehouses.store' },
      { id: 'warehouses.update' },
      { id: 'warehouses.destroy' },
    ],
  },
  {
    id: 'activities',
    permissions: [
      { id: 'activities.index' },
      { id: 'activities.show' },
    ],
  },
]

export const permissionIdSet: ReadonlySet<string> = new Set(
  permissionGroups.flatMap(group => group.permissions.map(permission => permission.id)),
)
