/** Backend may return flat strings or grouped { module, actions } */
export interface RolePermissionModule {
  module: string
  actions: string[]
}

export function normalizeLoadedPermissions(
  raw: Array<string | RolePermissionModule>,
): string[] {
  const result: string[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      result.push(item)
    } else if (item?.module && Array.isArray(item.actions)) {
      for (const action of item.actions) {
        result.push(`${item.module}.${action}`)
      }
    }
  }
  return result
}
