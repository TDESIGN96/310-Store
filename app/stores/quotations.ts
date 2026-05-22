import { defineStore } from 'pinia'
import type { QuotationProductOption } from '@/composables/useQuotationProducts'
import {
  calculateLineTotals,
  calculateQuotationSummary,
  formatTo2DecimalString,
  shouldAutoUpdateUnitPrice,
  type QuotationLineMathInput,
  type QuotationSummaryResult,
} from '@/utils/quotationMath'
import { getTieredUnitPrice } from '@/utils/tieredUnitPrice'

export interface QuotationPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export type QuotationStatus = 'active' | 'expired' | string

export interface QuotationListItem {
  id: number
  reference_number: string
  status: QuotationStatus
  issue_date: string
  expiry_date: string
  customer_name: string
  district_name: string
  total_discount: number
  grand_total: number
  created_at: string
  updated_at: string
}

export interface QuotationDraftItem {
  key: string
  product_id: number | null
  variation_id: number | null
  product: QuotationProductOption | null
  description: string
  qty: number
  unit_price: number
  discount_mode: 'fixed' | 'percentage'
  discount_value: number
  unit_price_manual: boolean
}

export interface QuotationDraft {
  id: number | null
  reference_number: string
  description: string
  customer_name: string
  customer_phone: string
  customer_email: string
  district_id: number | null
  issue_date: string
  expiry_date: string
  terms: string
  notes: string
  delivery_fees: number
  other_fees: number
  items: QuotationDraftItem[]
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const normalizePercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

const normalizeNonNegative = (value: number, fallback = 0): number => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

const createEmptyItem = (): QuotationDraftItem => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  product_id: null,
  variation_id: null,
  product: null,
  description: '',
  qty: 1,
  unit_price: 0,
  discount_mode: 'percentage',
  discount_value: 0,
  unit_price_manual: false,
})

const getVariationPrice = (item: QuotationDraftItem): number => {
  if (!item.product) return 0
  if (!item.variation_id) return item.product.price
  const variation = item.product.variations.find(v => v.id === item.variation_id)
  if (!variation) return item.product.price
  return getTieredUnitPrice(
    item.qty,
    variation.resolved_price || variation.price || item.product.price,
    variation.tiered_prices,
  )
}

const createEmptyDraft = (): QuotationDraft => ({
  id: null,
  reference_number: '',
  description: '',
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  district_id: null,
  issue_date: todayIso(),
  expiry_date: todayIso(),
  terms: '',
  notes: '',
  delivery_fees: 0,
  other_fees: 0,
  items: [createEmptyItem()],
})

export const useQuotationsStore = defineStore('quotations', () => {
  const { $api } = useApi()
  const draft = ref<QuotationDraft>(createEmptyDraft())
  const submitting = ref(false)
  const list = ref<QuotationListItem[]>([])
  const listLoading = ref(false)
  const pagination = ref<QuotationPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const currentQuotation = ref<Record<string, unknown> | null>(null)

  const toNumber = (value: unknown, fallback = 0): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }
  const toFiniteNumberOrUndefined = (value: unknown): number | undefined => {
    if (value === null || value === undefined) return undefined
    if (typeof value === 'string' && value.trim() === '') return undefined
    const num = Number(value)
    return Number.isFinite(num) ? num : undefined
  }

  const normalizeStatus = (value: unknown): QuotationStatus => {
    const status = String(value ?? '').toLowerCase()
    if (status === 'active' || status === 'expired') return status
    return status || 'active'
  }

  const extractPagination = (payload: unknown): QuotationPagination | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const raw = (nested?.pagination ?? root.pagination ?? null) as Record<string, unknown> | null
    if (!raw) return null
    return {
      current_page: toNumber(raw.current_page, 1),
      last_page: toNumber(raw.last_page, 1),
      per_page: toNumber(raw.per_page, 15),
      total: toNumber(raw.total, 0),
    }
  }

  const normalizeListItem = (payload: Record<string, unknown>): QuotationListItem => ({
    // Support both flat district_name and nested district.district shapes
    // returned by different backend serializers.
    // Keep empty string to let UI render localized fallback consistently.
    id: toNumber(payload.id, 0),
    reference_number: String(payload.reference_number ?? ''),
    status: normalizeStatus(payload.status),
    issue_date: String(payload.issue_date ?? ''),
    expiry_date: String(payload.expiry_date ?? ''),
    customer_name: String(payload.customer_name ?? ''),
    district_name: String(
      (
        (payload.district && typeof payload.district === 'object'
          ? (payload.district as Record<string, unknown>).district
          : null)
        ?? payload.district_name
        ?? ''
      ),
    ),
    total_discount: toNumber(payload.total_discount, 0),
    grand_total: toNumber(payload.grand_total, 0),
    created_at: String(payload.created_at ?? ''),
    updated_at: String(payload.updated_at ?? ''),
  })

  const extractList = (payload: unknown): QuotationListItem[] => {
    if (!payload || typeof payload !== 'object') return []
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const rows = (nested?.quotations ?? root.quotations ?? []) as unknown[]
    if (!Array.isArray(rows)) return []
    return rows
      .map(row => normalizeListItem((row ?? {}) as Record<string, unknown>))
      .filter(row => row.id > 0)
  }

  const extractQuotation = (payload: unknown): Record<string, unknown> | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const quotation = (nested?.quotation ?? root.quotation ?? null) as Record<string, unknown> | null
    return quotation && typeof quotation === 'object' ? quotation : null
  }

  const resolveHydratedDiscount = (
    item: Record<string, unknown>,
    qty: number,
  ): { mode: 'fixed' | 'percentage', value: number } => {
    const discountPercent = toNumber(item.discount_percent, NaN)
    if (Number.isFinite(discountPercent)) {
      return { mode: 'percentage', value: normalizePercent(discountPercent) }
    }

    // Fixed discount is now row-level (group qty), so hydrate as total line discount.
    const perUnitDiscount = Math.max(0, toNumber(item.discount, NaN))
    if (Number.isFinite(perUnitDiscount)) {
      return { mode: 'fixed', value: perUnitDiscount * Math.max(1, qty) }
    }

    const lineDiscount = Math.max(0, toNumber(item.line_discount, NaN))
    if (Number.isFinite(lineDiscount)) {
      return { mode: 'fixed', value: lineDiscount }
    }

    return { mode: 'percentage', value: 0 }
  }

  const hydrateDraftFromQuotation = (quotation: Record<string, unknown>) => {
    const items = (Array.isArray(quotation.items) ? quotation.items : [])
      .map((rawItem) => {
        const item = rawItem as Record<string, unknown>
        const productRaw = (item.product && typeof item.product === 'object' ? item.product : null) as Record<string, unknown> | null
        const variationRaw = (item.variation && typeof item.variation === 'object' ? item.variation : null) as Record<string, unknown> | null
        const mappedVariations = (Array.isArray(productRaw?.variations) ? productRaw.variations : [])
          .map((rawVariation) => {
            const variation = rawVariation as Record<string, unknown>
            return {
              id: toNumber(variation.id, 0),
              sku: String(variation.sku ?? ''),
              barcode: String(variation.barcode ?? ''),
              price: toNumber(variation.price, 0),
              resolved_price: toNumber(variation.resolved_price ?? variation.price, 0),
              is_active: true,
              label: String(variation.label ?? variation.sku ?? ''),
              tiered_prices: (Array.isArray(variation.tiered_prices) ? variation.tiered_prices : []).map((tierRaw) => {
                const tier = tierRaw as Record<string, unknown>
                return {
                  quantity_from: toNumber(tier.quantity_from, 0),
                  quantity_to: toNumber(tier.quantity_to, 0),
                  price: toNumber(tier.price, 0),
                }
              }),
            }
          })
          .filter(v => v.id > 0)

        const selectedVariationId = toNumber(item.variation_id ?? variationRaw?.id, 0)
        const hasSelectedVariation = selectedVariationId > 0 && mappedVariations.some(v => v.id === selectedVariationId)
        if (!hasSelectedVariation && variationRaw && selectedVariationId > 0) {
          mappedVariations.unshift({
            id: selectedVariationId,
            sku: String(variationRaw.sku ?? ''),
            barcode: String(variationRaw.barcode ?? ''),
            price: toNumber(variationRaw.price, 0),
            resolved_price: toNumber(variationRaw.resolved_price ?? variationRaw.price, 0),
            is_active: true,
            label: String(variationRaw.label ?? variationRaw.sku ?? ''),
            tiered_prices: (Array.isArray(variationRaw.tiered_prices) ? variationRaw.tiered_prices : []).map((tierRaw) => {
              const tier = tierRaw as Record<string, unknown>
              return {
                quantity_from: toNumber(tier.quantity_from, 0),
                quantity_to: toNumber(tier.quantity_to, 0),
                price: toNumber(tier.price, 0),
              }
            }),
          })
        }

        const product: QuotationProductOption | null = productRaw
          ? {
              id: toNumber(productRaw.id, 0),
              name_ar: String(productRaw.name_ar ?? ''),
              name_en: String(productRaw.name_en ?? ''),
              barcode: String(productRaw.barcode ?? ''),
              price: toNumber(productRaw.price, 0),
              is_available: true,
              is_combo: Boolean(productRaw.is_combo),
              variations: mappedVariations,
            }
          : null

        const qty = Math.max(1, toNumber(item.qty, 1))
        const hydratedDiscount = resolveHydratedDiscount(item, qty)

        return {
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          product_id: toNumber(item.product_id ?? product?.id, 0) || null,
          variation_id: selectedVariationId || null,
          product,
          description: String(item.description ?? ''),
          qty,
          unit_price: Math.max(0, toNumber(item.unit_price, 0)),
          discount_mode: hydratedDiscount.mode,
          discount_value: hydratedDiscount.value,
          unit_price_manual: true,
        }
      })
      .filter(item => item.product_id)

    draft.value = {
      id: toNumber(quotation.id, 0) || null,
      reference_number: String(quotation.reference_number ?? ''),
      description: String(quotation.description ?? ''),
      customer_name: String(quotation.customer_name ?? ''),
      customer_phone: String(quotation.customer_phone ?? ''),
      customer_email: String(quotation.customer_email ?? ''),
      district_id: toNumber(quotation.district_id, 0) || null,
      issue_date: String(quotation.issue_date ?? todayIso()),
      expiry_date: String(quotation.expiry_date ?? todayIso()),
      terms: String(quotation.terms ?? ''),
      notes: String(quotation.notes ?? ''),
      delivery_fees: Math.max(
        0,
        toNumber(
          quotation.delivery_fees
          ?? (
            quotation.district && typeof quotation.district === 'object'
              ? (quotation.district as Record<string, unknown>).delivery_fee
              : undefined
          ),
          Math.max(0, toNumber(quotation.grand_total, 0) - toNumber(quotation.subtotal, 0) + toNumber(quotation.total_discount, 0)),
        ),
      ),
      other_fees: Math.max(
        0,
        toNumber(
          toFiniteNumberOrUndefined(quotation.other_fees)
          ?? toFiniteNumberOrUndefined(
            quotation.district && typeof quotation.district === 'object'
              ? (quotation.district as Record<string, unknown>).other_fees
              : undefined,
          ),
          0,
        ),
      ),
      items: items.length ? items : [createEmptyItem()],
    }
  }

  const rowMath = (item: QuotationDraftItem) => calculateLineTotals({
    qty: item.qty,
    unitPrice: item.unit_price,
    discountMode: item.discount_mode,
    discountValue: item.discount_value,
  })

  const summary = computed<QuotationSummaryResult>(() => {
    const rows: QuotationLineMathInput[] = draft.value.items.map(item => ({
      qty: item.qty,
      unitPrice: item.unit_price,
      discountMode: item.discount_mode,
      discountValue: item.discount_value,
    }))
    return calculateQuotationSummary({
      rows,
      deliveryFees: draft.value.delivery_fees,
      otherFees: draft.value.other_fees,
    })
  })

  const resetDraft = () => {
    draft.value = createEmptyDraft()
  }

  const addRow = () => {
    draft.value.items.push(createEmptyItem())
  }

  const clearRow = (index: number) => {
    const current = draft.value.items[index]
    if (!current) return
    draft.value.items[index] = {
      ...createEmptyItem(),
      key: current.key,
    }
  }

  const removeRow = (index: number) => {
    if (draft.value.items.length <= 1) {
      clearRow(index)
      return
    }
    draft.value.items.splice(index, 1)
  }

  const clearAllRows = () => {
    draft.value.items = [createEmptyItem()]
  }

  const setRowProduct = (index: number, product: QuotationProductOption, variationId: number | null = null) => {
    const row = draft.value.items[index]
    if (!row) return
    row.product = product
    row.product_id = product.id
    row.variation_id = variationId
    row.unit_price_manual = false
    if (product.variations.length === 1 && !variationId) {
      row.variation_id = product.variations[0]?.id ?? null
    }
    row.unit_price = getVariationPrice(row)
  }

  const setRowVariation = (index: number, variationId: number | null) => {
    const row = draft.value.items[index]
    if (!row) return
    row.variation_id = variationId
    if (shouldAutoUpdateUnitPrice(row.unit_price_manual)) {
      row.unit_price = getVariationPrice(row)
    }
  }

  const setRowQty = (index: number, qty: number) => {
    const row = draft.value.items[index]
    if (!row) return
    row.qty = normalizeNonNegative(qty, 1) || 1
    if (shouldAutoUpdateUnitPrice(row.unit_price_manual)) {
      row.unit_price = getVariationPrice(row)
    }
  }

  const setRowUnitPrice = (index: number, value: number) => {
    const row = draft.value.items[index]
    if (!row) return
    row.unit_price = normalizeNonNegative(value, 0)
    row.unit_price_manual = true
  }

  const resetRowUnitPrice = (index: number) => {
    const row = draft.value.items[index]
    if (!row) return
    row.unit_price_manual = false
    row.unit_price = getVariationPrice(row)
  }

  const setRowDiscountMode = (index: number, mode: 'fixed' | 'percentage') => {
    const row = draft.value.items[index]
    if (!row) return
    row.discount_mode = mode
  }

  const setRowDiscountValue = (index: number, value: number) => {
    const row = draft.value.items[index]
    if (!row) return
    const n = Number(value)
    row.discount_value = Number.isFinite(n) ? Math.max(0, n) : 0
  }

  const rowDiscountPercentage = (unitPrice: number, discountPerUnit: number): string => {
    if (!(unitPrice > 0)) return formatTo2DecimalString(0)
    return formatTo2DecimalString((discountPerUnit / unitPrice) * 100)
  }

  const buildPayload = () => ({
    reference_number: draft.value.reference_number || undefined,
    description: draft.value.description || undefined,
    customer_name: draft.value.customer_name || undefined,
    customer_phone: draft.value.customer_phone || undefined,
    customer_email: draft.value.customer_email || undefined,
    district_id: draft.value.district_id || undefined,
    issue_date: draft.value.issue_date,
    expiry_date: draft.value.expiry_date,
    terms: draft.value.terms || undefined,
    notes: draft.value.notes || undefined,
    delivery_fees: draft.value.delivery_fees || 0,
    other_fees: draft.value.other_fees || 0,
    subtotal: summary.value.subtotal,
    total_discount: summary.value.totalDiscount,
    grand_total: summary.value.grandTotal,
    items: draft.value.items
      .filter(item => item.product_id)
      .map((item) => {
        const totals = rowMath(item)
        const discountPercentage = rowDiscountPercentage(item.unit_price, totals.discount)
        return {
          product_id: item.product_id,
          variation_id: item.variation_id,
          description: item.description || undefined,
          qty: item.qty,
          unit_price: item.unit_price,
          discount: formatTo2DecimalString(totals.discount),
          discount_percentage: discountPercentage,
          line_discount: discountPercentage,
          row_total: totals.rowTotal,
        }
      }),
  })

  const loadList = async (params: Record<string, string | number | undefined> = {}) => {
    listLoading.value = true
    try {
      const response = await $api('/quotations', { params })
      list.value = extractList(response)
      const nextPagination = extractPagination(response)
      if (nextPagination) pagination.value = nextPagination
      return list.value
    }
    finally {
      listLoading.value = false
    }
  }

  const loadById = async (id: string | number) => {
    const response = await $api(`/quotations/${id}`)
    const quotation = extractQuotation(response)
    currentQuotation.value = quotation
    return quotation
  }

  const loadDraftById = async (id: string | number) => {
    const quotation = await loadById(id)
    if (!quotation) return null
    hydrateDraftFromQuotation(quotation)
    return quotation
  }

  const createQuotation = async () => {
    const payload = buildPayload()
    return await $api('/quotations', { method: 'POST', body: payload })
  }

  const updateQuotation = async (id: string | number) => {
    const payload = buildPayload()
    return await $api(`/quotations/${id}`, { method: 'PUT', body: payload })
  }

  const deleteQuotation = async (id: string | number) => {
    return await $api(`/quotations/${id}`, { method: 'DELETE' })
  }

  return {
    draft,
    submitting,
    list,
    listLoading,
    pagination,
    currentQuotation,
    summary,
    rowMath,
    resetDraft,
    addRow,
    clearRow,
    removeRow,
    clearAllRows,
    setRowProduct,
    setRowVariation,
    setRowQty,
    setRowUnitPrice,
    resetRowUnitPrice,
    setRowDiscountMode,
    setRowDiscountValue,
    buildPayload,
    hydrateDraftFromQuotation,
    loadList,
    loadById,
    loadDraftById,
    createQuotation,
    updateQuotation,
    deleteQuotation,
  }
})
