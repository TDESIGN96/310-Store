import { computed, ref } from 'vue'
import {
  permissionGroups as staticPermissionGroups,
  permissionIdSet as staticPermissionIdSet,
  type PermissionGroup,
  type PermissionItem,
} from '@/config/permissions'

/**
 * Loads the live permission catalog from `GET /permissions` and groups it by
 * the first segment before the dot (e.g. `reports.sales.show` -> group `reports`).
 * Falls back to the static catalog in `@/config/permissions` until the first
 * successful load, or permanently if the request fails.
 */

const catalogGroups = ref<PermissionGroup[]>(staticPermissionGroups)
const catalogIdSet = ref<Set<string>>(new Set(staticPermissionIdSet))
const catalogLoading = ref(false)
const catalogLoaded = ref(false)
const catalogError = ref('')
let catalogPromise: Promise<void> | null = null

const dedupe = (ids: string[]): string[] => [...new Set(ids)]

const pushPermissionValue = (value: unknown, ids: string[]) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) ids.push(trimmed)
    return
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.module === 'string' && Array.isArray(obj.actions)) {
      obj.actions.forEach((action) => {
        if (typeof action === 'string' && action.trim()) ids.push(`${obj.module}.${action.trim()}`)
      })
      return
    }
    const name = obj.name ?? obj.key ?? obj.permission ?? obj.slug
    if (typeof name === 'string' && name.trim()) ids.push(name.trim())
  }
}

const visitList = (value: unknown, ids: string[]): boolean => {
  if (!Array.isArray(value)) return false
  value.forEach(item => pushPermissionValue(item, ids))
  return true
}

/** Supports flat string arrays, `{name|key}` objects, and grouped `{module, actions}` shapes. */
const extractPermissionIds = (payload: unknown): string[] => {
  const ids: string[] = []

  if (visitList(payload, ids)) return dedupe(ids)

  if (payload && typeof payload === 'object') {
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const candidates = [root.permissions, nested?.permissions, nested]
    for (const candidate of candidates) {
      if (visitList(candidate, ids)) return dedupe(ids)
    }
  }

  return dedupe(ids)
}

/** Backend report permissions are named `<report>_report.<action>` (e.g. `sales_summary_report.view`). */
const REPORT_MODULE_SUFFIX = '_report'

const buildGroups = (ids: string[]): PermissionGroup[] => {
  const order: string[] = []
  const map = new Map<string, PermissionItem[]>()

  for (const rawId of ids) {
    const id = rawId.trim()
    if (!id) continue

    const dot = id.indexOf('.')
    let groupId = dot === -1 ? id : id.slice(0, dot)
    // Unify all per-report permissions under a single "reports" group instead of
    // one group per report (sales_summary_report, purchase_summary_report, ...).
    if (groupId.endsWith(REPORT_MODULE_SUFFIX)) groupId = 'reports'

    if (!map.has(groupId)) {
      map.set(groupId, [])
      order.push(groupId)
    }

    const items = map.get(groupId)!
    if (!items.some(item => item.id === id)) items.push({ id })
  }

  return order.map(groupId => ({ id: groupId, permissions: map.get(groupId) ?? [] }))
}

export function usePermissionCatalog() {
  const { $api } = useApi()

  const loadPermissionCatalog = async (force = false): Promise<void> => {
    if (force) catalogLoaded.value = false
    if (catalogLoaded.value) return

    if (!catalogPromise) {
      catalogLoading.value = true
      catalogError.value = ''
      catalogPromise = $api('/permissions')
        .then((response) => {
          const ids = extractPermissionIds(response)
          if (ids.length) {
            catalogGroups.value = buildGroups(ids)
            catalogIdSet.value = new Set(ids)
          }
          catalogLoaded.value = true
        })
        .catch(() => {
          catalogError.value = 'failed'
        })
        .finally(() => {
          catalogLoading.value = false
          catalogPromise = null
        })
    }

    await catalogPromise
  }

  return {
    permissionGroups: computed(() => catalogGroups.value),
    permissionIdSet: computed(() => catalogIdSet.value),
    permissionCatalogLoading: catalogLoading,
    permissionCatalogError: catalogError,
    loadPermissionCatalog,
  }
}
