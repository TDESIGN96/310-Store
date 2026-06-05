import { ref } from 'vue'

export interface QuotationProductVariation {
  id: number
  sku: string
  barcode: string
  price: number
  resolved_price: number
  is_active: boolean
  label: string
  tiered_prices: Array<{
    quantity_from: number
    quantity_to: number
    price: number
  }>
}

export interface QuotationProductOption {
  id: number
  name_ar: string
  name_en: string
  barcode: string
  price: number
  is_available: boolean
  is_combo: boolean
  variations: QuotationProductVariation[]
}

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const toBool = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true'

const normalizeVariation = (raw: Record<string, unknown>): QuotationProductVariation => ({
  id: toNumber(raw.id, 0),
  sku: String(raw.sku ?? ''),
  barcode: String(raw.barcode ?? ''),
  price: toNumber(raw.price, 0),
  resolved_price: toNumber(raw.resolved_price ?? raw.price, 0),
  is_active: toBool(raw.is_active),
  label: String(raw.label ?? raw.sku ?? `#${toNumber(raw.id, 0)}`),
  tiered_prices: (Array.isArray(raw.tiered_prices) ? raw.tiered_prices : []).map((row) => {
    const tier = row as Record<string, unknown>
    return {
      quantity_from: toNumber(tier.quantity_from, 0),
      quantity_to: toNumber(tier.quantity_to, 0),
      price: toNumber(tier.price, 0),
    }
  }),
})

const normalizeProduct = (raw: Record<string, unknown>): QuotationProductOption => ({
  id: toNumber(raw.id, 0),
  name_ar: String(raw.name_ar ?? ''),
  name_en: String(raw.name_en ?? ''),
  barcode: String(raw.barcode ?? ''),
  price: toNumber(raw.price, 0),
  is_available: raw.is_available === undefined ? true : toBool(raw.is_available),
  is_combo: toBool(raw.is_combo),
  variations: (Array.isArray(raw.variations) ? raw.variations : [])
    .map(row => normalizeVariation(row as Record<string, unknown>))
    .filter(variation => variation.id > 0 && variation.is_active),
})

const extractProductsList = (payload: unknown): QuotationProductOption[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
  const candidates = [root.products, root.data, nested?.products, nested?.data]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map(row => normalizeProduct((row ?? {}) as Record<string, unknown>))
        .filter(product => product.id > 0)
    }
  }
  return []
}

const extractProductDetail = (payload: unknown): QuotationProductOption | null => {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
  const productCandidate = (nested?.product ?? root.product ?? null) as Record<string, unknown> | null
  if (!productCandidate) return null
  const normalized = normalizeProduct(productCandidate)
  return normalized.id > 0 ? normalized : null
}

export interface SearchProductsOptions {
  warehouseId?: number
  categoryId?: number
}

const appendListFilter = (
  params: Record<string, string | number>,
  index: number,
  column: string,
  value: string | number,
) => {
  params[`filters[${index}][column]`] = column
  params[`filters[${index}][value]`] = value
  params[`filters[${index}][condition]`] = '='
  params[`filters[${index}][operator]`] = 'and'
}

export const useQuotationProducts = () => {
  const { $api } = useApi()
  const loadingProducts = ref(false)
  const resolvingBarcode = ref(false)

  const searchProducts = async (
    query: string,
    options?: SearchProductsOptions,
  ): Promise<QuotationProductOption[]> => {
    const text = query.trim()
    loadingProducts.value = true
    try {
      const params: Record<string, string | number> = {
        page: 1,
        per_page: 50,
      }
      if (text) {
        params.search = text
        params.name = text
      }
      let filterIndex = 0
      if (options?.warehouseId) {
        appendListFilter(params, filterIndex++, 'warehouse_id', options.warehouseId)
      }
      if (options?.categoryId) {
        appendListFilter(params, filterIndex++, 'category_id', options.categoryId)
      }
      const res = await $api('/products', {
        params,
      })
      return extractProductsList(res)
        .filter(product => !product.is_combo && product.is_available)
    }
    finally {
      loadingProducts.value = false
    }
  }

  const getProductById = async (productId: number): Promise<QuotationProductOption | null> => {
    if (!productId) return null
    const res = await $api(`/products/${productId}`)
    const product = extractProductDetail(res)
    if (!product) return null
    return !product.is_combo && product.is_available ? product : null
  }

  const lookupBarcode = async (
    barcode: string,
    options?: SearchProductsOptions,
  ): Promise<{ product: QuotationProductOption; variationId: number | null } | null> => {
    const normalizedBarcode = barcode.trim()
    if (!normalizedBarcode) return null
    resolvingBarcode.value = true
    try {
      const matches = await searchProducts(normalizedBarcode, options)
      for (const match of matches) {
        const full = await getProductById(match.id)
        if (!full) continue
        const matchedVariation = full.variations.find(v => v.barcode === normalizedBarcode)
        if (matchedVariation) {
          return { product: full, variationId: matchedVariation.id }
        }
        if (full.barcode === normalizedBarcode && full.variations.length <= 1) {
          return { product: full, variationId: full.variations[0]?.id ?? null }
        }
      }
      return null
    }
    finally {
      resolvingBarcode.value = false
    }
  }

  return {
    loadingProducts,
    resolvingBarcode,
    searchProducts,
    getProductById,
    lookupBarcode,
  }
}
