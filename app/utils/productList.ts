import { extractPaginationFromListResponse } from '@/utils/categoryList'

/** API rejects per_page above this value (see validation: max 100). */
export const PRODUCTS_LIST_MAX_PER_PAGE = 100

export type ProductsApi = (url: string, opts?: { params?: Record<string, string | number> }) => Promise<unknown>

/**
 * Normalizes GET /products list responses from the Laravel API.
 */
export function extractProductsFromListResponse<T extends { id: number }>(raw: unknown): T[] {
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

  let out = tryArray(r.products)
  if (out?.length) return out

  out = tryArray(r.data)
  if (out?.length) return out

  const inner = r.data
  if (!inner || typeof inner !== 'object') return []

  const d = inner as Record<string, unknown>

  out = tryArray(d.products)
  if (out?.length) return out

  const paginated = fromPaginator(d.products)
  if (paginated?.length) return paginated

  out = tryArray(d.data)
  if (out?.length) return out

  const paginatedRoot = fromPaginator(d.data)
  if (paginatedRoot?.length) return paginatedRoot

  const nested = d.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const d2 = nested as Record<string, unknown>
    out = tryArray(d2.products)
    if (out?.length) return out
    out = tryArray(d2.data)
    if (out?.length) return out
    const p2 = fromPaginator(d2.products)
    if (p2?.length) return p2
  }

  return []
}

/**
 * Fetches all product rows for report filters by paging with the legal per_page cap.
 */
export async function fetchAllProductsPages<T extends { id: number }>(
  $api: ProductsApi,
  extraParams: Record<string, string | number> = {},
): Promise<T[]> {
  const merged: T[] = []
  let page = 1
  let lastPage = 1
  const maxPages = 100

  do {
    const raw = await $api('/products', {
      params: {
        page,
        per_page: PRODUCTS_LIST_MAX_PER_PAGE,
        ...extraParams,
      },
    })
    merged.push(...extractProductsFromListResponse<T>(raw))
    const p = extractPaginationFromListResponse(raw)
    lastPage = p?.last_page ?? 1
    page++
    if (page > maxPages) break
  } while (page <= lastPage)

  return merged
}
