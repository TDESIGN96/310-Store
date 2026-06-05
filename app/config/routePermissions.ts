/**
 * Maps URL paths to required permission(s) (Laravel-style module.action).
 * `null` = no module gate for this path (still requires login if middleware runs after auth).
 * List routes use `['module.index', 'module.show']` so either permission grants access.
 */
const RULES: { pattern: RegExp; permission: string | string[] | null }[] = [
  // Units
  { pattern: /^\/units\/create\/?$/, permission: 'units.store' },
  { pattern: /^\/units\/edit\/[^/]+\/?$/, permission: 'units.update' },
  { pattern: /^\/units\/show\/[^/]+\/?$/, permission: 'units.show' },
  { pattern: /^\/units\/?$/, permission: ['units.index', 'units.show'] },

  // Districts
  { pattern: /^\/districts\/create\/?$/, permission: 'districts.store' },
  { pattern: /^\/districts\/edit\/[^/]+\/?$/, permission: 'districts.update' },
  { pattern: /^\/districts\/show\/[^/]+\/?$/, permission: 'districts.show' },
  { pattern: /^\/districts\/?$/, permission: ['districts.index', 'districts.show'] },

  // Distributors
  { pattern: /^\/distributors\/create\/?$/, permission: 'distributors.store' },
  { pattern: /^\/distributors\/edit\/[^/]+\/?$/, permission: 'distributors.update' },
  { pattern: /^\/distributors\/show\/[^/]+\/?$/, permission: 'distributors.show' },
  { pattern: /^\/distributors\/?$/, permission: ['distributors.index', 'distributors.show'] },

  // Categories
  { pattern: /^\/categories\/create\/?$/, permission: 'categories.store' },
  { pattern: /^\/categories\/edit\/[^/]+\/?$/, permission: 'categories.update' },
  { pattern: /^\/categories\/show\/[^/]+\/?$/, permission: 'categories.show' },
  { pattern: /^\/categories\/?$/, permission: ['categories.index', 'categories.show'] },

  // Users
  { pattern: /^\/users\/create\/?$/, permission: 'users.store' },
  { pattern: /^\/users\/edit\/[^/]+\/?$/, permission: 'users.update' },
  { pattern: /^\/users\/show\/[^/]+\/?$/, permission: 'users.show' },
  { pattern: /^\/users\/?$/, permission: ['users.index', 'users.show'] },

  // Roles
  { pattern: /^\/roles\/create\/?$/, permission: 'roles.store' },
  { pattern: /^\/roles\/edit\/[^/]+\/?$/, permission: 'roles.update' },
  { pattern: /^\/roles\/?$/, permission: ['roles.index', 'roles.show'] },

  // Products
  { pattern: /^\/products\/create\/?$/, permission: 'products.store' },
  { pattern: /^\/products\/edit\/[^/]+\/?$/, permission: 'products.update' },
  { pattern: /^\/products\/show\/[^/]+\/?$/, permission: 'products.show' },
  { pattern: /^\/products\/?$/, permission: ['products.index', 'products.show'] },

  // Warehouses
  { pattern: /^\/warehouses\/create\/?$/, permission: 'warehouses.store' },
  { pattern: /^\/warehouses\/edit\/[^/]+\/?$/, permission: 'warehouses.update' },
  { pattern: /^\/warehouses\/show\/[^/]+\/?$/, permission: 'warehouses.show' },
  { pattern: /^\/warehouses\/?$/, permission: ['warehouses.index', 'warehouses.show'] },

  // Invoices
  { pattern: /^\/invoices\/create\/?$/, permission: 'invoices.store' },
  { pattern: /^\/invoices\/return\/[^/]+\/?$/, permission: 'invoice_returns.store' },
  { pattern: /^\/invoices\/edit\/[^/]+\/?$/, permission: 'invoices.update' },
  { pattern: /^\/invoices\/show\/[^/]+\/?$/, permission: 'invoices.show' },
  { pattern: /^\/invoices\/?$/, permission: ['invoices.index', 'invoices.show'] },

  // Purchase bills
  { pattern: /^\/purchase-bills\/create\/?$/, permission: 'purchase_bills.store' },
  { pattern: /^\/purchase-bills\/edit\/[^/]+\/?$/, permission: 'purchase_bills.update' },
  { pattern: /^\/purchase-bills\/show\/[^/]+\/?$/, permission: 'purchase_bills.show' },
  { pattern: /^\/purchase-bills\/?$/, permission: ['purchase_bills.index', 'purchase_bills.show'] },

  // Invoice returns
  { pattern: /^\/invoice-returns\/edit\/[^/]+\/?$/, permission: 'invoice_returns.update' },
  { pattern: /^\/invoice-returns\/show\/[^/]+\/?$/, permission: 'invoice_returns.show' },
  { pattern: /^\/invoice-returns\/?$/, permission: ['invoice_returns.index', 'invoice_returns.show'] },

  // Activity log
  { pattern: /^\/activities\/?$/, permission: ['activities.index', 'activities.show'] },

  // Stocktaking orders
  { pattern: /^\/stocktaking-orders\/review\/[^/]+\/?$/, permission: 'stocktaking.review' },
  { pattern: /^\/stocktaking-orders\/count\/[^/]+\/?$/, permission: 'stocktaking.count' },
  { pattern: /^\/stocktaking-orders\/create\/?$/, permission: 'stocktaking.create' },
  { pattern: /^\/stocktaking-orders\/show\/[^/]+\/?$/, permission: 'stocktaking.view' },
  { pattern: /^\/stocktaking-orders\/?$/, permission: 'stocktaking.view' },
]

/**
 * Returns required permission(s) for a path, or `null` if no rule matches.
 * Caller should require the user to have **at least one** when an array is returned.
 */
export function getRequiredPermissionsForPath(path: string): string[] | null {
  const clean = (path.split('?')[0] ?? path).replace(/\/$/, '') || '/'
  for (const { pattern, permission } of RULES) {
    if (!pattern.test(clean)) continue
    if (permission === null) return null
    if (Array.isArray(permission)) return permission
    return [permission]
  }
  return null
}

/** @deprecated Use getRequiredPermissionsForPath — kept for any external imports */
export function getRequiredPermissionForPath(path: string): string | null {
  const perms = getRequiredPermissionsForPath(path)
  if (!perms?.length) return null
  return perms.length === 1 ? perms[0]! : perms.join('|')
}
