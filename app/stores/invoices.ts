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

export interface InvoicePagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export type InvoiceStatus = 'issued' | 'paid' | 'partially_returned' | 'returned' | string

export interface InvoiceListItem {
  id: number
  reference_number: string
  warehouse_id: number | null
  warehouse_name_ar: string
  warehouse_name_en: string
  customer_name: string
  district_name: string
  invoice_date: string
  supply_date: string
  status: InvoiceStatus
  total_discount: number
  grand_total: number
  return_reference_number: string
}

export interface InvoiceDraftItem {
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

export interface InvoiceDraft {
  id: number | null
  reference_number: string
  warehouse_id: number | null
  district_id: number | null
  description: string
  address: string
  customer_name: string
  customer_mobile: string
  customer_email: string
  invoice_date: string
  supply_date: string
  terms: string
  notes: string
  delivery_fees: number
  items: InvoiceDraftItem[]
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

const createEmptyItem = (): InvoiceDraftItem => ({
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

const createEmptyDraft = (): InvoiceDraft => ({
  id: null,
  reference_number: '',
  warehouse_id: null,
  district_id: null,
  description: '',
  address: '',
  customer_name: '',
  customer_mobile: '',
  customer_email: '',
  invoice_date: todayIso(),
  supply_date: todayIso(),
  terms: '',
  notes: '',
  delivery_fees: 0,
  items: [createEmptyItem()],
})

const getVariationPrice = (item: InvoiceDraftItem): number => {
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

export const useInvoicesStore = defineStore('invoices', () => {
  const { $api } = useApi()
  const INVOICES_ENDPOINT = '/v1/invoices'
  const draft = ref<InvoiceDraft>(createEmptyDraft())
  const submitting = ref(false)
  const list = ref<InvoiceListItem[]>([])
  const listLoading = ref(false)
  const pagination = ref<InvoicePagination>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const currentInvoice = ref<Record<string, unknown> | null>(null)

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

  const normalizeStatus = (value: unknown): InvoiceStatus => {
    const status = String(value ?? '').toLowerCase()
    if (status === 'issued' || status === 'paid' || status === 'partially_returned' || status === 'returned') return status
    return status || 'issued'
  }

  const extractPagination = (payload: unknown): InvoicePagination | null => {
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

  const normalizeListItem = (payload: Record<string, unknown>): InvoiceListItem => {
    const warehouse = (payload.warehouse && typeof payload.warehouse === 'object' ? payload.warehouse : null) as Record<string, unknown> | null
    const district = (payload.district && typeof payload.district === 'object' ? payload.district : null) as Record<string, unknown> | null
    return {
      id: toNumber(payload.id, 0),
      reference_number: String(payload.reference_number ?? ''),
      warehouse_id: toNumber(payload.warehouse_id ?? warehouse?.id, 0) || null,
      warehouse_name_ar: String(warehouse?.name_ar ?? ''),
      warehouse_name_en: String(warehouse?.name_en ?? ''),
      customer_name: String(payload.customer_name ?? ''),
      district_name: String(district?.district ?? payload.district_name ?? ''),
      invoice_date: String(payload.invoice_date ?? ''),
      supply_date: String(payload.supply_date ?? ''),
      status: normalizeStatus(payload.status),
      total_discount: toNumber(payload.total_discount, 0),
      grand_total: toNumber(payload.grand_total, 0),
      return_reference_number: String(payload.return_reference_number ?? payload.return_ref_id ?? ''),
    }
  }

  const extractList = (payload: unknown): InvoiceListItem[] => {
    if (!payload || typeof payload !== 'object') return []
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const rows = (nested?.invoices ?? root.invoices ?? []) as unknown[]
    if (!Array.isArray(rows)) return []
    return rows
      .map(row => normalizeListItem((row ?? {}) as Record<string, unknown>))
      .filter(row => row.id > 0)
  }

  const extractInvoice = (payload: unknown): Record<string, unknown> | null => {
    if (!payload || typeof payload !== 'object') return null
    const root = payload as Record<string, unknown>
    const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null
    const invoice = (nested?.invoice ?? root.invoice ?? null) as Record<string, unknown> | null
    return invoice && typeof invoice === 'object' ? invoice : null
  }

  const resolveHydratedDiscount = (
    item: Record<string, unknown>,
    qty: number,
  ): { mode: 'fixed' | 'percentage', value: number } => {
    const perUnitDiscount = Math.max(0, toNumber(item.discount, NaN))
    if (Number.isFinite(perUnitDiscount)) {
      return { mode: 'fixed', value: perUnitDiscount }
    }

    const discountPercent = toNumber(item.discount_percentage ?? item.discount_percent, NaN)
    if (Number.isFinite(discountPercent)) {
      return { mode: 'percentage', value: normalizePercent(discountPercent) }
    }

    const lineDiscount = Math.max(0, toNumber(item.line_discount, NaN))
    if (Number.isFinite(lineDiscount) && qty > 0) {
      return { mode: 'fixed', value: lineDiscount / qty }
    }

    return { mode: 'percentage', value: 0 }
  }

  const hydrateDraftFromInvoice = (invoice: Record<string, unknown>) => {
    const items = (Array.isArray(invoice.items) ? invoice.items : [])
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
      id: toNumber(invoice.id, 0) || null,
      reference_number: String(invoice.reference_number ?? ''),
      warehouse_id: toNumber(invoice.warehouse_id ?? ((invoice.warehouse as Record<string, unknown> | null)?.id), 0) || null,
      district_id: toNumber(
        invoice.district_id
        ?? ((invoice.district as Record<string, unknown> | null)?.id),
        0,
      ) || null,
      description: String(invoice.description ?? ''),
      address: String(invoice.address ?? ''),
      customer_name: String(invoice.customer_name ?? ''),
      customer_mobile: String(invoice.customer_mobile ?? ''),
      customer_email: String(invoice.customer_email ?? ''),
      invoice_date: String(invoice.invoice_date ?? todayIso()),
      supply_date: String(invoice.supply_date ?? todayIso()),
      terms: String(invoice.terms ?? ''),
      notes: String(invoice.notes ?? ''),
      delivery_fees: Math.max(
        0,
        toNumber(
          invoice.delivery_fees
          ?? ((invoice.district as Record<string, unknown> | null)?.delivery_fee),
          0,
        ),
      ),
      items: items.length ? items : [createEmptyItem()],
    }
  }

  const hydrateDraftFromQuotationForConvert = (quotation: Record<string, unknown>) => {
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

    const quotationFallbackDelivery = Math.max(
      0,
      toNumber(quotation.grand_total, 0) - toNumber(quotation.subtotal, 0) + toNumber(quotation.total_discount, 0),
    )
    const resolvedConvertedDeliveryFees = toFiniteNumberOrUndefined(quotation.delivery_fees)
      ?? toFiniteNumberOrUndefined(quotation.delivery_fee)
      ?? toFiniteNumberOrUndefined((quotation.district as Record<string, unknown> | null)?.delivery_fee)
      ?? quotationFallbackDelivery

    draft.value = {
      id: null,
      reference_number: '',
      warehouse_id: null,
      district_id: toNumber(
        quotation.district_id
        ?? ((quotation.district as Record<string, unknown> | null)?.id),
        0,
      ) || null,
      description: String(quotation.description ?? ''),
      address: String(quotation.address ?? ''),
      customer_name: String(quotation.customer_name ?? ''),
      customer_mobile: String(quotation.customer_phone ?? ''),
      customer_email: String(quotation.customer_email ?? ''),
      invoice_date: String(quotation.issue_date ?? todayIso()),
      supply_date: String(quotation.expiry_date ?? todayIso()),
      terms: String(quotation.terms ?? ''),
      notes: String(quotation.notes ?? ''),
      delivery_fees: Math.max(0, resolvedConvertedDeliveryFees),
      items: items.length ? items : [createEmptyItem()],
    }
  }

  const rowMath = (item: InvoiceDraftItem) => calculateLineTotals({
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

  const buildPayload = () => ({
    reference_number: draft.value.reference_number || undefined,
    warehouse_id: draft.value.warehouse_id,
    district_id: draft.value.district_id || undefined,
    description: draft.value.description || undefined,
    address: draft.value.address || undefined,
    customer_name: draft.value.customer_name || undefined,
    customer_mobile: draft.value.customer_mobile || undefined,
    customer_email: draft.value.customer_email || undefined,
    invoice_date: draft.value.invoice_date,
    supply_date: draft.value.supply_date || undefined,
    terms: draft.value.terms || undefined,
    notes: draft.value.notes || undefined,
    delivery_fees: draft.value.delivery_fees || 0,
    subtotal: summary.value.subtotal,
    total_discount: summary.value.totalDiscount,
    grand_total: summary.value.grandTotal,
    items: draft.value.items
      .filter(item => item.product_id)
      .map((item) => {
        const totals = rowMath(item)
        return {
          product_id: item.product_id,
          variation_id: item.variation_id,
          description: item.description || undefined,
          qty: item.qty,
          unit_price: item.unit_price,
          discount: formatTo2DecimalString(totals.discount),
          line_discount: formatTo2DecimalString(totals.lineDiscount),
          discount_percentage: formatTo2DecimalString(item.unit_price > 0 ? (totals.discount / item.unit_price) * 100 : 0),
          row_total: formatTo2DecimalString(totals.rowTotal),
        }
      }),
  })

  const loadList = async (params: Record<string, string | number | undefined> = {}) => {
    listLoading.value = true
    try {
      const response = await $api(INVOICES_ENDPOINT, { params })
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
    const response = await $api(`${INVOICES_ENDPOINT}/${id}`)
    const invoice = extractInvoice(response)
    currentInvoice.value = invoice
    return invoice
  }

  const loadDraftById = async (id: string | number) => {
    const invoice = await loadById(id)
    if (!invoice) return null
    hydrateDraftFromInvoice(invoice)
    return invoice
  }

  const createInvoice = async () => {
    const payload = buildPayload()
    return await $api(INVOICES_ENDPOINT, { method: 'POST', body: payload })
  }

  const updateInvoice = async (id: string | number) => {
    const payload = buildPayload()
    return await $api(`${INVOICES_ENDPOINT}/${id}`, { method: 'PUT', body: payload })
  }

  const deleteInvoice = async (id: string | number) => {
    return await $api(`${INVOICES_ENDPOINT}/${id}`, { method: 'DELETE' })
  }

  return {
    draft,
    submitting,
    list,
    listLoading,
    pagination,
    currentInvoice,
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
    hydrateDraftFromInvoice,
    hydrateDraftFromQuotationForConvert,
    loadList,
    loadById,
    loadDraftById,
    createInvoice,
    updateInvoice,
    deleteInvoice,
  }
})
