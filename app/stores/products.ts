import { defineStore } from 'pinia'

export interface DraftTieredPrice {
  quantity_from: number
  quantity_to: number
  price: number
}

export interface DraftVariation {
  id?: number
  sku: string
  barcode: string
  price: number
  buying_price: number
  stock_quantity: number
  is_active: boolean
  warehouse_id: number | null
  min_quantity: number
  allow_notification: boolean
  attribute_value_ids: number[]
  tiered_prices: DraftTieredPrice[]
}

export interface ProductDraft {
  name_ar: string
  name_en: string
  description: string
  main_image: string
  images: string[]
  category_id: number | null
  unit_id: number | null
  is_combo: boolean
  attribute_ids: number[]
  variations: DraftVariation[]
}

interface ProductShowResponse {
  data?: {
    product?: Record<string, unknown>
  }
  product?: Record<string, unknown>
}

interface VariationsListResponse {
  data?: { variations?: Array<Record<string, unknown>> }
  variations?: Array<Record<string, unknown>>
}

const emptyDraft = (): ProductDraft => ({
  name_ar: '',
  name_en: '',
  description: '',
  main_image: '',
  images: [],
  category_id: null,
  unit_id: null,
  is_combo: false,
  attribute_ids: [],
  variations: [],
})

const toNumber = (v: unknown, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const draftVariationFromApi = (row: Record<string, unknown>): DraftVariation => {
  const attrValues = Array.isArray(row.attribute_values) ? row.attribute_values as Array<Record<string, unknown>> : []
  return {
    id: toNumber(row.id, 0) || undefined,
    sku: String(row.sku ?? ''),
    barcode: String(row.barcode ?? ''),
    price: toNumber(row.price, 0),
    buying_price: toNumber(row.buying_price, 0),
    stock_quantity: toNumber(row.stock_quantity, 0),
    is_active: row.is_active !== false && row.is_active !== 0 && row.is_active !== '0',
    warehouse_id: toNumber((row.inventory as any)?.[0]?.warehouse_id ?? ((row.inventory as any)?.[0]?.warehouse as any)?.id, 0) || null,
    min_quantity: toNumber((row.inventory as any)?.[0]?.min_quantity, 0),
    allow_notification:
      (row.inventory as any)?.[0]?.allow_notification !== false
      && (row.inventory as any)?.[0]?.allow_notification !== 0
      && (row.inventory as any)?.[0]?.allow_notification !== '0',
    attribute_value_ids: attrValues.map(v => toNumber(v.id, 0)).filter(Boolean),
    tiered_prices: (Array.isArray(row.tiered_prices) ? row.tiered_prices : []).map((tp: any) => ({
      quantity_from: toNumber(tp?.quantity_from, 0),
      quantity_to: toNumber(tp?.quantity_to, 0),
      price: toNumber(tp?.price, 0),
    })),
  }
}

export const useProductsStore = defineStore('products', () => {
  const { $api } = useApi()
  const draft = ref<ProductDraft>(emptyDraft())
  const loading = ref(false)

  const resetDraft = () => {
    draft.value = emptyDraft()
  }

  const buildVariationInventory = (
    warehouseId: number | null,
    quantity: number,
    minQuantity: number,
    allowNotification: boolean,
  ) => {
    if (!warehouseId) return []
    return [{
      warehouse_id: warehouseId,
      quantity,
      min_quantity: minQuantity,
      allow_notification: allowNotification,
    }]
  }

  const createProductPayload = (includeVariations = false) => ({
    name_ar: draft.value.name_ar,
    name_en: draft.value.name_en,
    price: 10,
    description: draft.value.description || undefined,
    main_image: draft.value.main_image || undefined,
    images: draft.value.images.length ? draft.value.images : undefined,
    category_id: draft.value.category_id,
    unit_id: draft.value.unit_id,
    is_combo: draft.value.is_combo,
    attribute_ids: draft.value.attribute_ids,
    variations: includeVariations && draft.value.variations.length
      ? draft.value.variations.map(v => ({
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        buying_price: v.buying_price,
        stock_quantity: v.stock_quantity,
        is_active: v.is_active,
        attribute_value_ids: v.attribute_value_ids,
        tiered_prices: v.tiered_prices?.length ? v.tiered_prices : [],
        inventory: buildVariationInventory(v.warehouse_id, v.stock_quantity, v.min_quantity, v.allow_notification),
      }))
      : undefined,
  })

  const hydrateDraftFromProduct = (raw: Record<string, unknown>) => {
    const variationsRaw = Array.isArray(raw.variations) ? raw.variations as Array<Record<string, unknown>> : []
    const attrIds = Array.isArray(raw.attribute_ids) ? raw.attribute_ids.map(v => toNumber(v, 0)).filter(Boolean) : []

    draft.value = {
      name_ar: String(raw.name_ar ?? ''),
      name_en: String(raw.name_en ?? ''),
      description: String(raw.description ?? ''),
      main_image: String(raw.main_image_url ?? ''),
      images: Array.isArray(raw.images) ? raw.images.map(v => String(v)) : [],
      category_id: toNumber((raw.category as any)?.id ?? raw.category_id, 0) || null,
      unit_id: toNumber((raw.unit as any)?.id ?? raw.unit_id, 0) || null,
      is_combo: raw.is_combo === true || raw.is_combo === 1 || raw.is_combo === '1',
      attribute_ids: attrIds,
      variations: variationsRaw.map(draftVariationFromApi),
    }
  }

  const loadProductDraft = async (id: string | number) => {
    loading.value = true
    try {
      const res = await $api<ProductShowResponse>(`/products/${id}`)
      const product = res.data?.product ?? res.product
      if (!product) return null
      hydrateDraftFromProduct(product)
      return product
    }
    finally {
      loading.value = false
    }
  }

  const listVariations = async (productId: string | number) => {
    const res = await $api<VariationsListResponse>(`/products/${productId}/variations`)
    return res.data?.variations ?? res.variations ?? []
  }

  const getVariation = async (productId: string | number, variationId: string | number) => {
    return await $api(`/products/${productId}/variations/${variationId}`)
  }

  const createVariation = async (productId: string | number, payload: Record<string, unknown>) => {
    return await $api(`/products/${productId}/variations`, { method: 'POST', body: payload })
  }

  const updateVariation = async (
    productId: string | number,
    variationId: string | number,
    payload: Record<string, unknown>,
  ) => {
    return await $api(`/products/${productId}/variations/${variationId}`, { method: 'PUT', body: payload })
  }

  const deleteVariation = async (productId: string | number, variationId: string | number) => {
    return await $api(`/products/${productId}/variations/${variationId}`, { method: 'DELETE' })
  }

  const activateVariation = async (productId: string | number, variationId: string | number) => {
    return await $api(`/products/${productId}/variations/${variationId}/activate`, { method: 'POST' })
  }

  const deactivateVariation = async (productId: string | number, variationId: string | number) => {
    return await $api(`/products/${productId}/variations/${variationId}/deactivate`, { method: 'POST' })
  }

  return {
    draft,
    loading,
    resetDraft,
    createProductPayload,
    loadProductDraft,
    listVariations,
    getVariation,
    createVariation,
    updateVariation,
    deleteVariation,
    activateVariation,
    deactivateVariation,
  }
})
