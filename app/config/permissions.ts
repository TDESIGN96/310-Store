export type PermissionAction = 'index' | 'show' | 'store' | 'update' | 'destroy'
export type PermissionModule =
  | 'users'
  | 'roles'
  | 'products'
  | 'quotations'
  | 'invoices'
  | 'purchase_bills'
  | 'invoice_returns'
  | 'product_variations'
  | 'units'
  | 'distributors'
  | 'districts'
  | 'categories'
  | 'attributes'
  | 'reports'
  | 'warehouses'
  | 'activities'
  | 'stocktaking'
  | 'damage'
export type PermissionKey = `${PermissionModule}.${PermissionAction}`
export type StocktakingPermissionKey =
  | 'stocktaking.view'
  | 'stocktaking.create'
  | 'stocktaking.count'
  | 'stocktaking.review'
  | 'stocktaking.cancel'

export type DamagePermissionKey =
  | 'damage.view'
  | 'damage.create'
  | 'damage.edit'
  | 'damage.approve'
  | 'damage.cancel'
  | 'damage.disposition'

export interface PermissionItem {
  id: PermissionKey | StocktakingPermissionKey | DamagePermissionKey
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
    id: 'purchase_bills',
    permissions: [
      { id: 'purchase_bills.index' },
      { id: 'purchase_bills.show' },
      { id: 'purchase_bills.store' },
      { id: 'purchase_bills.update' },
      { id: 'purchase_bills.destroy' },
    ],
  },
  {
    id: 'invoice_returns',
    permissions: [
      { id: 'invoice_returns.index' },
      { id: 'invoice_returns.show' },
      { id: 'invoice_returns.store' },
      { id: 'invoice_returns.update' },
      { id: 'invoice_returns.destroy' },
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
    id: 'distributors',
    permissions: [
      { id: 'distributors.index' },
      { id: 'distributors.show' },
      { id: 'distributors.store' },
      { id: 'distributors.update' },
      { id: 'distributors.destroy' },
    ],
  },
  {
    id: 'districts',
    permissions: [
      { id: 'districts.index' },
      { id: 'districts.show' },
      { id: 'districts.store' },
      { id: 'districts.update' },
      { id: 'districts.destroy' },
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
  {
    id: 'stocktaking',
    permissions: [
      { id: 'stocktaking.view' },
      { id: 'stocktaking.create' },
      { id: 'stocktaking.count' },
      { id: 'stocktaking.review' },
      { id: 'stocktaking.cancel' },
    ],
  },
  {
    id: 'damage',
    permissions: [
      { id: 'damage.view' },
      { id: 'damage.create' },
      { id: 'damage.edit' },
      { id: 'damage.approve' },
      { id: 'damage.cancel' },
      { id: 'damage.disposition' },
    ],
  },
]

export const permissionIdSet: ReadonlySet<string> = new Set(
  permissionGroups.flatMap(group => group.permissions.map(permission => permission.id)),
)
