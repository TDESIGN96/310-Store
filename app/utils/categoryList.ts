/** API rejects per_page above this value (see validation: max 100). */
export const CATEGORIES_LIST_MAX_PER_PAGE = 100

/**
 * Reads pagination metadata from GET /categories index responses.
 */
export function extractPaginationFromListResponse(raw: unknown): { current_page: number; last_page: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const inner = r.data
  const p = (r.pagination
    ?? (inner && typeof inner === 'object' ? (inner as Record<string, unknown>).pagination : undefined)) as
    Record<string, unknown> | undefined
  if (!p || typeof p !== 'object') return null
  const last = Number(p.last_page)
  const cur = Number(p.current_page)
  if (!Number.isFinite(last) || last < 1) return null
  return {
    current_page: Number.isFinite(cur) && cur >= 1 ? cur : 1,
    last_page: last,
  }
}

export type CategoriesApi = (url: string, opts?: { params?: Record<string, string | number> }) => Promise<unknown>

/**
 * Fetches all category rows for parent pickers by paging with the legal per_page cap.
 */
export async function fetchAllCategoriesPages<T extends { id: number }>(
  $api: CategoriesApi,
  extraParams: Record<string, string | number> = {},
): Promise<T[]> {
  const merged: T[] = []
  let page = 1
  let lastPage = 1
  const maxPages = 100

  do {
    const raw = await $api('/categories', {
      params: {
        page,
        per_page: CATEGORIES_LIST_MAX_PER_PAGE,
        ...extraParams,
      },
    })
    merged.push(...extractCategoriesFromListResponse<T>(raw))
    const p = extractPaginationFromListResponse(raw)
    lastPage = p?.last_page ?? 1
    page++
    if (page > maxPages) break
  } while (page <= lastPage)

  return merged
}

/**
 * Normalizes GET /categories list responses from the Laravel API.
 * Supports: top-level categories[], envelope { data: { categories } },
 * paginator-shaped categories ({ data: [] }), and extra nesting.
 */
export function extractCategoriesFromListResponse<T extends { id: number }>(raw: unknown): T[] {
  if (!raw || typeof raw !== 'object') return []

  const tryArray = (v: unknown): T[] | null =>
    (Array.isArray(v) ? (v as T[]) : null)

  const fromPaginator = (v: unknown): T[] | null => {
    if (!v || typeof v !== 'object') return null
    const o = v as Record<string, unknown>
    if (Array.isArray(o.data)) return o.data as T[]
    return null
  }

  const r = raw as Record<string, unknown>

  let out = tryArray(r.categories)
  if (out?.length) return out

  out = tryArray(r.data)
  if (out?.length) return out

  const inner = r.data
  if (!inner || typeof inner !== 'object') return []

  const d = inner as Record<string, unknown>

  out = tryArray(d.categories)
  if (out?.length) return out

  const paginated = fromPaginator(d.categories)
  if (paginated?.length) return paginated

  // Laravel paginator: data: { data: CategoryRow[], current_page, ... }
  out = tryArray(d.data)
  if (out?.length) return out
  const paginatedRoot = fromPaginator(d.data)
  if (paginatedRoot?.length) return paginatedRoot

  // e.g. data: { data: { categories: [...] } }
  const nested = d.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const d2 = nested as Record<string, unknown>
    out = tryArray(d2.categories)
    if (out?.length) return out
    out = tryArray(d2.data)
    if (out?.length) return out
    const p2 = fromPaginator(d2.categories)
    if (p2?.length) return p2
  }

  return []
}
