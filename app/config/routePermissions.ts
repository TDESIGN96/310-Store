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

  // Products (legacy key from navigation)
  // { pattern: /^\/products\/create\/?$/, permission: 'view_products' },
  // { pattern: /^\/products\/?$/, permission: 'view_products' },

  // Warehouses
  { pattern: /^\/warehouses\/create\/?$/, permission: 'warehouses.store' },
  { pattern: /^\/warehouses\/edit\/[^/]+\/?$/, permission: 'warehouses.update' },
  { pattern: /^\/warehouses\/show\/[^/]+\/?$/, permission: 'warehouses.show' },
  { pattern: /^\/warehouses\/?$/, permission: ['warehouses.index', 'warehouses.show'] },

  // Activity log
  { pattern: /^\/activities\/?$/, permission: ['activities.index', 'activities.show'] },
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
