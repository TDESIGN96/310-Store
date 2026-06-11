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

export interface PurchaseBillPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export type PurchaseBillStatus = 'pending' | 'in_delivery' | 'complete' | 'returned' | 'partially_returned' | string

export interface PurchaseBillListItem {
  id: number
  reference_number: string
  warehouse_id: number | null
  warehouse_name_ar: string
  warehouse_name_en: string
  supplier_name: string
  district_name: string
  bill_date: string
  supply_date: string
  status: PurchaseBillStatus
  status_label: string
  total_discount: number
  grand_total: number
}

export interface PurchaseBillAdditionalCost {
  name: string
  amount: number
}

export interface PurchaseBillDraftItem {
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

export interface PurchaseBillDraft {
  id: number | null
  reference_number: string
  warehouse_id: number | null
  district_id: number | null
  status: PurchaseBillStatus
  description: string
  address: string
  supplier_name: string
  supplier_mobile: string
  supplier_email: string
  bill_date: string
  supply_date: string
  terms: string
  notes: string
  other_fees: number
  additional_costs: PurchaseBillAdditionalCost[]
  items: PurchaseBillDraftItem[]
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const toDateInputValue = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
  return match ? match[1]! : ''
}

const normalizePercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

const normalizeNonNegative = (value: number, fallback = 0): number => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

const createEmptyItem = (): PurchaseBillDraftItem => ({
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

const createEmptyDraft = (): PurchaseBillDraft => ({
  id: null,
  reference_number: '',
  warehouse_id: null,
  district_id: null,
  status: 'pending',
  description: '',
  address: '',
  supplier_name: '',
  supplier_mobile: '',
  supplier_email: '',
  bill_date: todayIso(),
  supply_date: todayIso(),
  terms: '',
  notes: '',
  other_fees: 0,
  additional_costs: [],
  items: [createEmptyItem()],
})

// Purchase-bill-only cache of variation buying prices (keyed by variation id),
// populated from the product detail endpoint. Kept local to this store so the
// shared product composable / quotations / invoices stay untouched.
const buyingPriceByVariation: Record<number, number> = {}
const buyingPriceFetchByProduct: Record<number, Promise<void>> = {}

const getVariationPrice = (item: PurchaseBillDraftItem): number => {
  if (!item.product) return 0
  const variationId = item.variation_id
  if (variationId) {
    const buyingPrice = buyingPriceByVariation[variationId]
    if (buyingPrice && buyingPrice > 0) return buyingPrice
  }
  if (!variationId) return item.product.price
  const variation = item.product.variations.find(v => v.id === variationId)
  if (!variation) return item.product.price
  return getTieredUnitPrice(
    item.qty,
    variation.resolved_price || variation.price || item.product.price,
    variation.tiered_prices,
  )
}

export const usePurchaseBillsStore = defineStore('purchaseBills', () => {
  const { $api } = useApi()
  const PURCHASE_BILLS_ENDPOINT = '/purchase-bills'
  const draft = ref<PurchaseBillDraft>(createEmptyDraft())
  const submitting = ref(false)
  const list = ref<PurchaseBillListItem[]>([])
  const listLoading = ref(false)
  const pagination = ref<PurchaseBillPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const currentPurchaseBill = ref<Record<string, unknown> | null>(null)

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

  const cacheBuyingPricesFromRawVariations = (rawVariations: unknown) => {
    if (!Array.isArray(rawVariations)) return
    for (const raw of rawVariations) {
      if (!raw || typeof raw !== 'object') continue
      const variation = raw as Record<string, unknown>
      const id = toNumber(variation.id, 0)
      if (id > 0) buyingPriceByVariation[id] = toNumber(variation.buying_price, 0)
    }
  }

  const ensureBuyingPricesForProduct = async (productId: number) => {
    if (!productId) return
    const cached = buyingPriceFetchByProduct[productId]
    if (cached) {
      await cached
      return
    }
    const fetchPromise = (async () => {
      try {
        const res = await $api<Record<string, unknown>>(`/products/${productId}`)
        const nested = res.data && typeof res.data === 'object' ? res.data as Record<string, unknown> : null
        const product = (nested?.product ?? res.product ?? nested ?? res) as Record<string, unknown>
        cacheBuyingPricesFromRawVariations(product.variations)
      }
      catch {
        return
      }
      finally {
        delete buyingPriceFetchByProduct[productId]
      }
    })()
    buyingPriceFetchByProduct[productId] = fetchPromise
    await fetchPromise
  }

  const normalizeStatus = (value: unknown): PurchaseBillStatus => {
    const status = String(value ?? '').toLowerCase()
    if (
      status === 'pending'
      || status === 'in_delivery'
      || status === 'complete'
      || status === 'returned'
      || status === 'partially_returned'
    ) return status
    return status || 'pending'
  }

  const extractPagination = (payload: unknown): PurchaseBillPagination | null => {
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

  const normalizeListItem = (payload: Record<string, unknown>): PurchaseBillListItem => {
    const warehouse = (payload.warehouse && typeof payload.warehouse === 'object' ? payload.warehouse : null) as Record<string, unknown> | null
    const district = (payload.district && typeof payload.district === 'object' ? payload.district : null) as Record<string, unknown> | null
    return {
      id: toNumber(payload.id, 0),
      reference_number: String(payload.reference_number ?? ''),
      warehouse_id: toNumber(payload.warehouse_id ?? warehouse?.id, 0) || null,
      warehouse_name_ar: String(warehouse?.name_ar ?? ''),
      warehouse_name_en: String(warehouse?.name_en ?? ''),
      supplier_name: String(payload.supplier_name ?? payload.customer_name ?? ''),
      district_name: String(district?.district ?? payload.district_name ?? ''),
      bill_date: String(payload.bill_date ?? payload.invoice_date ?? ''),
      supply_date: String(payload.supply_date ?? ''),
      status: normalizeStatus(payload.status),
      status_label: String(payload.status_label ?? payload.status ?? ''),
      total_discount: toNumber(payload.total_discount, 0),
      grand_total: toNumber(payload.grand_total, 0),
    }
  }

  const extractList = (payload: unknown): PurchaseBillListItem[] => {
    if (!payload || typeof payload !== 'object') return []
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const rows = (nested?.purchase_bills ?? root.purchase_bills ?? nested?.bills ?? root.bills ?? []) as unknown[]
    if (!Array.isArray(rows)) return []
    return rows
      .map(row => normalizeListItem((row ?? {}) as Record<string, unknown>))
      .filter(row => row.id > 0)
  }

  const extractPurchaseBill = (payload: unknown): Record<string, unknown> | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const bill = (
      nested?.purchase_bill
      ?? root.purchase_bill
      ?? nested?.bill
      ?? root.bill
      ?? null
    ) as Record<string, unknown> | null
    return bill && typeof bill === 'object' ? bill : null
  }

  const resolveHydratedDiscount = (
    item: Record<string, unknown>,
    qty: number,
  ): { mode: 'fixed' | 'percentage', value: number } => {
    const discountPercent = toNumber(item.discount_percentage ?? item.discount_percent, NaN)
    if (Number.isFinite(discountPercent)) {
      return { mode: 'percentage', value: normalizePercent(discountPercent) }
    }

    const perUnitDiscount = Math.max(0, toNumber(item.discount, NaN))
    const lineDiscount = Math.max(0, toNumber(item.line_discount, NaN))

    if (Number.isFinite(perUnitDiscount)) {
      return { mode: 'fixed', value: perUnitDiscount * Math.max(1, qty) }
    }

    if (Number.isFinite(lineDiscount)) {
      return { mode: 'fixed', value: lineDiscount }
    }

    return { mode: 'percentage', value: 0 }
  }

  const hydrateDraftFromPurchaseBill = (bill: Record<string, unknown>) => {
    const items = (Array.isArray(bill.items) ? bill.items : [])
      .map((rawItem) => {
        const item = rawItem as Record<string, unknown>
        const productRaw = (item.product && typeof item.product === 'object' ? item.product : null) as Record<string, unknown> | null
        const variationRaw = (item.variation && typeof item.variation === 'object' ? item.variation : null) as Record<string, unknown> | null
        cacheBuyingPricesFromRawVariations(productRaw?.variations)
        if (variationRaw) cacheBuyingPricesFromRawVariations([variationRaw])
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

    const additionalCosts = (Array.isArray(bill.additional_costs) ? bill.additional_costs : [])
      .map((costRaw) => {
        const cost = costRaw as Record<string, unknown>
        return {
          name: String(cost.name ?? ''),
          amount: Math.max(0, toNumber(cost.amount, 0)),
        }
      })
      .filter(cost => cost.name || cost.amount > 0)

    const supplier = (bill.supplier && typeof bill.supplier === 'object' ? bill.supplier : null) as Record<string, unknown> | null
    const district = (bill.district && typeof bill.district === 'object' ? bill.district : null) as Record<string, unknown> | null

    draft.value = {
      id: toNumber(bill.id, 0) || null,
      reference_number: String(bill.reference_number ?? ''),
      warehouse_id: toNumber(bill.warehouse_id ?? ((bill.warehouse as Record<string, unknown> | null)?.id), 0) || null,
      district_id: toNumber(
        bill.district_id
        ?? district?.id,
        0,
      ) || null,
      status: normalizeStatus(bill.status),
      description: String(bill.description ?? ''),
      address: String(bill.address ?? supplier?.address ?? ''),
      supplier_name: String(bill.supplier_name ?? supplier?.name ?? bill.customer_name ?? ''),
      supplier_mobile: String(bill.supplier_mobile ?? supplier?.mobile ?? supplier?.phone ?? bill.customer_mobile ?? ''),
      supplier_email: String(bill.supplier_email ?? supplier?.email ?? bill.customer_email ?? ''),
      bill_date: toDateInputValue(bill.bill_date ?? bill.invoice_date) || todayIso(),
      supply_date: toDateInputValue(bill.supply_date) || todayIso(),
      terms: String(bill.terms ?? ''),
      notes: String(bill.notes ?? ''),
      other_fees: Math.max(
        0,
        toNumber(
          toFiniteNumberOrUndefined(bill.other_fees)
          ?? toFiniteNumberOrUndefined((bill.district as Record<string, unknown> | null)?.other_fees),
          0,
        ),
      ),
      additional_costs: additionalCosts,
      items: items.length ? items : [createEmptyItem()],
    }
  }

  const rowMath = (item: PurchaseBillDraftItem) => calculateLineTotals({
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
      deliveryFees: 0,
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

  const setRowProduct = async (index: number, product: QuotationProductOption, variationId: number | null = null) => {
    const row = draft.value.items[index]
    if (!row) return
    row.product = product
    row.product_id = product.id
    row.variation_id = variationId
    row.unit_price_manual = false
    if (product.variations.length === 1 && !variationId) {
      row.variation_id = product.variations[0]?.id ?? null
    }
    await ensureBuyingPricesForProduct(product.id)
    row.unit_price = getVariationPrice(row)
  }

  const setRowVariation = async (index: number, variationId: number | null) => {
    const row = draft.value.items[index]
    if (!row) return
    row.variation_id = variationId
    if (shouldAutoUpdateUnitPrice(row.unit_price_manual)) {
      if (row.product_id) await ensureBuyingPricesForProduct(row.product_id)
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
    warehouse_id: draft.value.warehouse_id,
    district_id: draft.value.district_id || undefined,
    status: draft.value.status || undefined,
    description: draft.value.description || undefined,
    address: draft.value.address || undefined,
    supplier_name: draft.value.supplier_name || undefined,
    supplier_mobile: draft.value.supplier_mobile || undefined,
    supplier_email: draft.value.supplier_email || undefined,
    bill_date: draft.value.bill_date,
    supply_date: draft.value.supply_date || undefined,
    terms: draft.value.terms || undefined,
    notes: draft.value.notes || undefined,
    other_fees: draft.value.other_fees || 0,
    additional_costs: draft.value.additional_costs,
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
          discount: formatTo2DecimalString(totals.lineDiscount),
          discount_percentage: discountPercentage,
          row_total: totals.rowTotal,
        }
      }),
  })

  const loadList = async (params: Record<string, string | number | undefined> = {}) => {
    listLoading.value = true
    try {
      const response = await $api(PURCHASE_BILLS_ENDPOINT, { params })
      list.value = extractList(response)
      const nextPagination = extractPagination(response)
      if (nextPagination) pagination.value = nextPagination
      return list.value
    }
    catch (error: unknown) {
      throw error
    }
    finally {
      listLoading.value = false
    }
  }

  const loadById = async (id: string | number) => {
    const response = await $api(`${PURCHASE_BILLS_ENDPOINT}/${id}`)
    const bill = extractPurchaseBill(response)
    currentPurchaseBill.value = bill
    return bill
  }

  const loadDraftById = async (id: string | number) => {
    const bill = await loadById(id)
    if (!bill) return null
    hydrateDraftFromPurchaseBill(bill)
    return bill
  }

  const createPurchaseBill = async () => {
    const payload = buildPayload()
    return await $api(PURCHASE_BILLS_ENDPOINT, { method: 'POST', body: payload })
  }

  const updatePurchaseBill = async (id: string | number) => {
    const payload = buildPayload()
    return await $api(`${PURCHASE_BILLS_ENDPOINT}/${id}`, { method: 'PUT', body: payload })
  }

  const deletePurchaseBill = async (id: string | number) => {
    return await $api(`${PURCHASE_BILLS_ENDPOINT}/${id}`, { method: 'DELETE' })
  }

  return {
    draft,
    submitting,
    list,
    listLoading,
    pagination,
    currentPurchaseBill,
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
    hydrateDraftFromPurchaseBill,
    loadList,
    loadById,
    loadDraftById,
    createPurchaseBill,
    updatePurchaseBill,
    deletePurchaseBill,
  }
})
