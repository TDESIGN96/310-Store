export type PermissionAction = 'index' | 'show' | 'store' | 'update' | 'destroy'
export type PermissionModule = 'users' | 'roles' | 'units' | 'categories' | 'reports'
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
    id: 'reports',
    permissions: [
      { id: 'reports.index' },
      { id: 'reports.show' },
      { id: 'reports.store' },
      { id: 'reports.update' },
      { id: 'reports.destroy' },
    ],
  },
]

export const permissionIdSet: ReadonlySet<string> = new Set(
  permissionGroups.flatMap(group => group.permissions.map(permission => permission.id)),
)
