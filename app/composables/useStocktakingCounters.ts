import { ref } from 'vue'
import { normalizeLoadedPermissions, type RolePermissionModule } from '@/utils/rolePermissions'

export interface CounterOption {
  id: number
  name: string
  email?: string
}

interface UserRole {
  id: number
  name?: string
  name_en?: string
  name_ar?: string
}

interface UserListItem {
  id: number
  name: string
  email?: string
  is_active?: boolean
  permissions?: unknown
  roles?: UserRole[]
}

interface UsersResponse {
  users?: UserListItem[]
  pagination?: { last_page?: number }
  data?: {
    users?: UserListItem[]
    pagination?: { last_page?: number }
  }
}

interface RoleListItem {
  id: number | string
}

interface RolesResponse {
  roles?: RoleListItem[]
  data?: { roles?: RoleListItem[] }
}

interface RoleDetailResponse {
  data?: { permissions?: unknown }
}

const COUNTER_PERMISSION = 'stocktaking.count'

/** List API may return permissions as array, single module object, or keyed object — coerce safely. */
const coercePermissionsInput = (raw: unknown): Array<string | RolePermissionModule> => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as Array<string | RolePermissionModule>
  if (typeof raw === 'string') return [raw]
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if (typeof obj.module === 'string' && Array.isArray(obj.actions)) {
      return [raw as RolePermissionModule]
    }
    const values = Object.values(obj)
    if (values.length > 0) {
      return values.flatMap((value): Array<string | RolePermissionModule> => {
        if (typeof value === 'string') return [value]
        if (value && typeof value === 'object') {
          const mod = value as Record<string, unknown>
          if (typeof mod.module === 'string' && Array.isArray(mod.actions)) {
            return [value as RolePermissionModule]
          }
        }
        return []
      })
    }
  }
  return []
}

const hasStocktakingCountPermission = (permissions: unknown): boolean => {
  return normalizeLoadedPermissions(coercePermissionsInput(permissions)).includes(COUNTER_PERMISSION)
}

export const useStocktakingCounters = () => {
  const { $api } = useApi()
  const loadingCounters = ref(false)

  const loadEligibleRoleIds = async (): Promise<Set<number>> => {
    const eligible = new Set<number>()
    try {
      const rolesRes = await $api<RolesResponse>('/roles', { params: { per_page: 100 } })
      const roles = rolesRes.roles ?? rolesRes.data?.roles ?? []
      const results = await Promise.all(
        roles.map(role =>
          $api<RoleDetailResponse>(`/roles/${role.id}`).catch(() => null),
        ),
      )
      results.forEach((res, index) => {
        const raw = res?.data?.permissions
        if (!hasStocktakingCountPermission(raw)) return
        const role = roles[index]
        if (!role) return
        const roleId = Number(role.id)
        if (Number.isFinite(roleId) && roleId > 0) eligible.add(roleId)
      })
    }
    catch {
      return eligible
    }
    return eligible
  }

  const isEligibleCounter = (user: UserListItem, eligibleRoleIds: Set<number>): boolean => {
    if (user.is_active === false) return false
    if (hasStocktakingCountPermission(user.permissions)) return true
    return (user.roles ?? []).some(role => eligibleRoleIds.has(Number(role.id)))
  }

  const loadAvailableCounters = async (): Promise<CounterOption[]> => {
    loadingCounters.value = true
    try {
      const eligibleRoleIds = await loadEligibleRoleIds()
      const aggregated: UserListItem[] = []
      let page = 1
      let lastPage = 1
      const maxPages = 50

      do {
        const data = await $api<UsersResponse>('/users', {
          params: {
            page,
            per_page: 100,
            'filters[0][column]': 'is_active',
            'filters[0][value]': 1,
            'filters[0][condition]': '=',
            'filters[0][operator]': 'and',
          },
        })
        const list = data.users ?? data.data?.users ?? []
        aggregated.push(...list)
        lastPage = data.pagination?.last_page ?? data.data?.pagination?.last_page ?? 1
        page++
      } while (page <= lastPage && page <= maxPages)

      return aggregated
        .filter(user => isEligibleCounter(user, eligibleRoleIds))
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    catch {
      return []
    }
    finally {
      loadingCounters.value = false
    }
  }

  return {
    loadingCounters,
    loadAvailableCounters,
  }
}
