export type PermissionAction = 'index' | 'show' | 'store' | 'update' | 'destroy'
export type PermissionModule = 'users' | 'roles' | 'units' | 'categories' | 'reports'
export type PermissionKey = `${PermissionModule}.${PermissionAction}`

export interface PermissionItem {
  id: PermissionKey
  label: string
}

export interface PermissionGroup {
  id: PermissionModule
  label: string
  permissions: PermissionItem[]
}

export const permissionGroups: PermissionGroup[] = [
  {
    id: 'users',
    label: 'إدارة المستخدمين',
    permissions: [
      { id: 'users.index', label: 'عرض قائمة المستخدمين' },
      { id: 'users.show', label: 'عرض مستخدم محدد' },
      { id: 'users.store', label: 'إنشاء مستخدم' },
      { id: 'users.update', label: 'تعديل المستخدم' },
      { id: 'users.destroy', label: 'حذف المستخدم' },
    ],
  },
  {
    id: 'roles',
    label: 'إدارة الأدوار',
    permissions: [
      { id: 'roles.index', label: 'عرض قائمة الأدوار' },
      { id: 'roles.show', label: 'عرض دور محدد' },
      { id: 'roles.store', label: 'إنشاء دور' },
      { id: 'roles.update', label: 'تعديل الدور' },
      { id: 'roles.destroy', label: 'حذف الدور' },
    ],
  },
  {
    id: 'units',
    label: 'إدارة الوحدات',
    permissions: [
      { id: 'units.index', label: 'عرض قائمة الوحدات' },
      { id: 'units.show', label: 'عرض وحدة محددة' },
      { id: 'units.store', label: 'إنشاء وحدة' },
      { id: 'units.update', label: 'تعديل الوحدة' },
      { id: 'units.destroy', label: 'حذف الوحدة' },
    ],
  },
  {
    id: 'categories',
    label: 'إدارة التصنيفات',
    permissions: [
      { id: 'categories.index', label: 'عرض قائمة التصنيفات' },
      { id: 'categories.show', label: 'عرض تصنيف محدد' },
      { id: 'categories.store', label: 'إنشاء تصنيف' },
      { id: 'categories.update', label: 'تعديل التصنيف' },
      { id: 'categories.destroy', label: 'حذف التصنيف' },
    ],
  },
  {
    id: 'reports',
    label: 'إدارة التقارير',
    permissions: [
      { id: 'reports.index', label: 'عرض قائمة التقارير' },
      { id: 'reports.show', label: 'عرض تقرير محدد' },
      { id: 'reports.store', label: 'إنشاء تقرير' },
      { id: 'reports.update', label: 'تعديل التقرير' },
      { id: 'reports.destroy', label: 'حذف التقرير' },
    ],
  },
]

export const permissionIdSet: ReadonlySet<string> = new Set(
  permissionGroups.flatMap(group => group.permissions.map(permission => permission.id)),
)
